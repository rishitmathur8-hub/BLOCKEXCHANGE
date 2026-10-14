
# app/scheduler.py
# CP-SAT scheduling with human approval required before execution.

from app.models import Section, Train, Request, Block
from app.merge import merge_requests
from app.cost import group_cost, separate_cost, block_cost
from app.predict import compute_buffers, buffer_for
from app.cpsat_scheduler import optimize_groups


PENDING = "pending_human_approval"


def hhmm(minutes):
    """Convert minutes into a readable 24-hour time."""
    minutes = int(minutes)
    return (
        f"{(minutes // 60) % 24:02d}:"
        f"{minutes % 60:02d}"
        + (" (+1d)" if minutes >= 1440 else "")
    )


def _request_problem(request, section_km):
    """Return a validation error, or None if the request is valid."""
    values = (
        request.km_from,
        request.km_to,
        request.duration_min,
        request.window_start,
        request.window_end,
    )

    if any(value is None for value in values):
        return "missing km, duration or time window"

    if request.km_to <= request.km_from:
        return "km_to must be greater than km_from"

    if request.km_from < 0 or request.km_to > section_km:
        return "km range outside the section"

    if request.duration_min <= 0:
        return "duration must be positive"

    if request.window_end <= request.window_start:
        return "time window must have a positive length"

    if request.window_end - request.window_start < request.duration_min:
        return "time window shorter than the duration"

    return None


def _clean_trains(trains):
    """Ignore trains with invalid timing or weight data."""
    valid = [
        train
        for train in trains
        if train.entry_time is not None
        and train.exit_time is not None
        and train.exit_time > train.entry_time
        and train.weight is not None
        and train.weight >= 0
    ]

    return valid, len(trains) - len(valid)


def _reject(request, reason):
    """Create a consistent unschedulable-request record."""
    return {
        "request_id": request.id,
        "dept": request.dept,
        "section_id": request.section_id,
        "reason": reason,
    }


def _req_summary(request):
    """Return the request fields needed in a proposal."""
    return {
        "id": request.id,
        "dept": request.dept,
        "work_type": request.work_type,
        "km_from": request.km_from,
        "km_to": request.km_to,
        "duration_min": request.duration_min,
        "window_start": request.window_start,
        "window_end": request.window_end,
    }


def _build_proposal(section, trains, buffers, group, best):
    """Build a human-reviewable proposal from a selected time slot."""
    length_km = section.length_km

    separate = separate_cost(
        trains,
        length_km,
        group["requests"],
    )

    request_buffers = [
        buffer_for(request.work_type, buffers)
        for request in group["requests"]
    ]

    suggested_buffer = max(request_buffers, default=0)

    start = best["start"]
    end = best["end"]
    safe_end = end + suggested_buffer

    # Calculate the cost if the block overruns by the estimated buffer.
    worst_cost, worst_delay, _ = block_cost(
        trains,
        length_km,
        group["km_from"],
        group["km_to"],
        start,
        safe_end,
    )

    warnings = []

    if not buffers:
        risk = "UNKNOWN"
        warnings.append(
            "no completed block history available; buffer may be unreliable"
        )
    elif suggested_buffer == 0:
        risk = "UNKNOWN"
        warnings.append(
            "no positive historical buffer for this group; "
            "overrun risk is unknown"
        )
    elif suggested_buffer <= 15:
        risk = "MEDIUM"
    else:
        risk = "HIGH"

    # The safety buffer must also fit inside the original requested window.
    feasible = safe_end <= group["window_end"]

    if not feasible:
        warnings.append(
            "safety buffer goes past the requested window; "
            "rescheduling required"
        )

    if best["cost"] > separate:
        warnings.append(
            "merging increases estimated cost by "
            f"{round(best['cost'] - separate, 1)}; "
            "review separate scheduling"
        )

    if not trains:
        warnings.append(
            "no train data for this section; cost is not meaningful"
        )

    request_ids = sorted(
        request.id for request in group["requests"]
    )

    return {
        "proposal_id": (
            f"S{section.id}-R" + "-".join(map(str, request_ids))
        ),
        "section_id": section.id,
        "section_name": section.name,
        "request_ids": request_ids,
        "requests": [
            _req_summary(request)
            for request in group["requests"]
        ],
        "depts": sorted({
            request.dept for request in group["requests"]
        }),
        "km_from": group["km_from"],
        "km_to": group["km_to"],
        "needs_power_block": group["needs_power_block"],
        "start": start,
        "end": end,
        "start_hhmm": hhmm(start),
        "end_hhmm": hhmm(end),
        "safe_end": safe_end,
        "safe_end_hhmm": hhmm(safe_end),
        "merged_cost": best["cost"],
        "separate_cost": separate,
        "cost_saved": round(separate - best["cost"], 1),
        "recommend_merge": (len(group["requests"]) > 1 and best["cost"] <= separate ),
        "train_delay_min": best["delay_min"],
        "affected_trains": best["affected"],
        "worst_case_cost": worst_cost,
        "worst_case_delay_min": worst_delay,
        "risk": risk,
        "expected_overrun_min": suggested_buffer,
        "suggested_buffer_min": suggested_buffer,
        "predicted_end": safe_end,
        "status": PENDING,
        "feasible": feasible,
        "conflicts_with": [],
        "warnings": warnings,
    }


def _flag_conflicts(proposals):
    """Flag spatially and temporally overlapping buffered proposals."""
    for index, first in enumerate(proposals):
        for second in proposals[index + 1:]:
            if first["section_id"] != second["section_id"]:
                continue

            km_overlap = (
                first["km_from"] < second["km_to"]
                and second["km_from"] < first["km_to"]
            )

            time_overlap = (
                first["start"] < second["safe_end"]
                and second["start"] < first["safe_end"]
            )

            if km_overlap and time_overlap:
                first["conflicts_with"].append(
                    second["proposal_id"]
                )
                second["conflicts_with"].append(
                    first["proposal_id"]
                )

                first["warnings"].append(
                    f"overlaps {second['proposal_id']}: manual review"
                )
                second["warnings"].append(
                    f"overlaps {first['proposal_id']}: manual review"
                )


def generate_schedule(db, section_id=None):
    """
    Generate maintenance proposals using CP-SAT.

    Requests that cannot be scheduled are returned in unschedulable.
    Proposals require human approval before execution.
    """
    output = {
        "proposals": [],
        "unschedulable": [],
        "warnings": [],
        "summary": {},
    }

    # Load sections.
    section_query = db.query(Section)

    if section_id is not None:
        section_query = section_query.filter(
            Section.id == section_id
        )

    sections = {
        section.id: section
        for section in section_query.all()
    }

    if not sections:
        output["warnings"].append("no sections found")
        return output

    # Only schedule requests that are not already assigned to a block.
    request_query = db.query(Request).filter(
        Request.block_id.is_(None)
    )

    if section_id is not None:
        request_query = request_query.filter(
            Request.section_id == section_id
        )

    requests_by_section = {}

    for request in request_query.all():
        requests_by_section.setdefault(
            request.section_id, []
        ).append(request)

    # Reject requests referencing unknown sections.
    for sid, requests in requests_by_section.items():
        if sid not in sections:
            output["unschedulable"].extend(
                _reject(request, "unknown section")
                for request in requests
            )

    buffers = compute_buffers(db)

    if not buffers:
        output["warnings"].append(
            "no completed block history; risk is UNKNOWN"
        )

    trains_by_section = {}
    sections_by_id = {}
    all_groups = []

    # Validate requests and merge them using the existing merge module.
    for sid, section in sections.items():
        requests = requests_by_section.get(sid, [])

        if not requests:
            continue

        if (
            section.length_km is None
            or section.length_km <= 0
        ):
            output["unschedulable"].extend(
                _reject(request, "section length missing or invalid")
                for request in requests
            )
            continue

        all_trains = (
            db.query(Train)
            .filter(Train.section_id == sid)
            .all()
        )

        trains, skipped = _clean_trains(all_trains)

        trains_by_section[sid] = trains
        sections_by_id[sid] = section

        if skipped:
            output["warnings"].append(
                f"{section.name}: {skipped} trains ignored (bad data)"
            )

        valid_requests = []

        for request in requests:
            problem = _request_problem(
                request,
                section.length_km,
            )

            if problem:
                output["unschedulable"].append(
                    _reject(request, problem)
                )
            else:
                valid_requests.append(request)

        if not valid_requests:
            continue

        try:
            groups = merge_requests(valid_requests)
        except Exception as exc:
            output["unschedulable"].extend(
                _reject(request, f"merge failed: {exc}")
                for request in valid_requests
            )
            continue

        all_groups.extend(groups)

    # Compute a conservative safety buffer for each merged group.
    buffers_by_group = {}

    for index, group in enumerate(all_groups):
        group_buffers = [
            buffer_for(request.work_type, buffers)
            for request in group["requests"]
        ]

        buffers_by_group[index] = max(
            group_buffers,
            default=0,
        )

    # Jointly optimize the prepared groups.
    selected = []

    if all_groups:
        try:
            selected = optimize_groups(
                trains_by_section,
                sections_by_id,
                all_groups,
                buffers_by_group=buffers_by_group,
                time_limit=10,
            )
        except Exception as exc:
            output["warnings"].append(
                f"CP-SAT scheduling error: {exc}"
            )
            selected = None

        if selected is None:
            output["warnings"].append(
                "CP-SAT could not find a feasible solution; "
                "no proposals were generated."
            )

            for group in all_groups:
                for request in group["requests"]:
                    output["unschedulable"].append(
                        _reject(
                            request,
                            "CP-SAT solver failed to find a feasible solution",
                        )
                    )
        else:
            selected_group_indices = {
                choice["group_index"]
                for choice in selected
            }

            # Reject only groups that were not selected by the optimizer.
            for group_index, group in enumerate(all_groups):
                if group_index not in selected_group_indices:
                    for request in group["requests"]:
                        output["unschedulable"].append(
                            _reject(
                                request,
                                "no feasible slot after safety buffers "
                                "and track-conflict constraints",
                            )
                        )

            # Build proposals using the selected slots and actual costs.
            for choice in selected:
                group = choice["group"]
                sid = group["section_id"]
                section = sections_by_id[sid]
                trains = trains_by_section[sid]

                best = {
                    "start": choice["start"],
                    "end": choice["end"],
                    "cost": choice["cost"],
                    "delay_min": choice["delay_min"],
                    "affected": choice["affected"],
                }

                proposal = _build_proposal(
                    section,
                    trains,
                    buffers,
                    group,
                    best,
                )

                output["proposals"].append(proposal)

    # Sort proposals and perform a final conflict check.
    output["proposals"].sort(
        key=lambda proposal: (
            proposal["section_id"],
            proposal["start"],
        )
    )

    _flag_conflicts(output["proposals"])

    proposals = output["proposals"]

    output["summary"] = {
        "proposals": len(proposals),
        "unschedulable_requests": len(output["unschedulable"]),
        "merged_cost": round(
            sum(p["merged_cost"] for p in proposals), 1
        ),
        "separate_cost": round(
            sum(p["separate_cost"] for p in proposals), 1
        ),
        "cost_saved": round(
            sum(p["cost_saved"] for p in proposals), 1
        ),
        "high_risk": sum(
            1 for p in proposals if p["risk"] == "HIGH"
        ),
        "with_conflicts": sum(
            1 for p in proposals if p["conflicts_with"]
        ),
        "infeasible": sum(
            1 for p in proposals if not p["feasible"]
        ),
        "merging_increases_cost": sum(
            1
            for p in proposals
            if p["merged_cost"] > p["separate_cost"]
        ),
    }

    return output


def save_proposals(db, proposals, commit=True):
    """
    Save feasible, conflict-free proposals as proposed blocks.

    Saving a proposal does not authorize maintenance execution.
    """
    saved = []
    skipped = []

    try:
        for proposal in proposals:
            if not proposal.get("feasible", True):
                skipped.append({
                    "proposal_id": proposal["proposal_id"],
                    "reason": "safety buffer exceeds requested window",
                })
                continue

            if proposal.get("conflicts_with"):
                skipped.append({
                    "proposal_id": proposal["proposal_id"],
                    "reason": "conflict",
                })
                continue

            request_ids = proposal["request_ids"]

            requests = (
                db.query(Request)
                .filter(Request.id.in_(request_ids))
                .all()
            )

            if (
                len(requests) != len(request_ids)
                or any(
                    request.block_id is not None
                    for request in requests
                )
            ):
                skipped.append({
                    "proposal_id": proposal["proposal_id"],
                    "reason": "requests changed or already assigned",
                })
                continue

            block = Block(
                section_id=proposal["section_id"],
                start=proposal["start"],
                end=proposal["end"],
                status="proposed",
            )

            db.add(block)
            db.flush()

            for request in requests:
                request.block_id = block.id

            saved.append({
                "proposal_id": proposal["proposal_id"],
                "block_id": block.id,
            })

        if commit:
            db.commit()

    except Exception:
        db.rollback()
        raise

    return {
        "saved": saved,
        "skipped": skipped,
    }


def optimize(db):
    """
    Generate maintenance proposals and save eligible proposals
    as blocks awaiting human approval.
    """
    output = generate_schedule(db)

    save_result = save_proposals(
        db,
        output["proposals"],
    )

    output["saved"] = save_result["saved"]
    output["skipped"] = save_result["skipped"]

    return output

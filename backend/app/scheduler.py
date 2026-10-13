
# app/scheduler.py
# Generates scheduling proposals. Human approval is required before execution.
# generate_schedule() is read-only.
# save_proposals() saves eligible proposals with status="proposed".

from app.models import Section, Train, Request, Block
from app.merge import merge_requests
from app.cost import group_cost, separate_cost, block_cost
from app.predict import compute_buffers, buffer_for

PENDING = "pending_human_approval"


def hhmm(minutes):
    minutes = int(minutes)
    return (
        f"{(minutes // 60) % 24:02d}:"
        f"{minutes % 60:02d}"
        + (" (+1d)" if minutes >= 1440 else "")
    )


# ---------- Validation helpers ----------

def _request_problem(request, section_km):
    """Return a reason when a request cannot be scheduled."""
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

    if request.window_end - request.window_start < request.duration_min:
        return "time window shorter than the duration"

    return None


def _clean_trains(trains):
    """Keep trains with usable timing and weight data."""
    valid = [
        train
        for train in trains
        if train.entry_time is not None
        and train.exit_time is not None
        and train.exit_time > train.entry_time
        and train.weight is not None
    ]
    return valid, len(trains) - len(valid)


def _reject(request, reason):
    return {
        "request_id": request.id,
        "dept": request.dept,
        "section_id": request.section_id,
        "reason": reason,
    }


def _req_summary(request):
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


# ---------- Build a proposal ----------

def _build_proposal(section, trains, buffers, group):
    length_km = section.length_km

    best = group_cost(trains, length_km, group)

    if best is None:
        return None, "no feasible start time inside the shared window"

    separate = separate_cost(
        trains,
        length_km,
        group["requests"],
    )

    # Use the largest historical buffer among the requests in this group.
    request_buffers = [
        buffer_for(request.work_type, buffers)
        for request in group["requests"]
    ]
    suggested_buffer = max(request_buffers, default=0)

    start = best["start"]
    end = best["end"]
    safe_end = end + suggested_buffer

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
            "no positive historical buffer for this group; overrun risk is unknown"
        )
    elif suggested_buffer <= 15:
        risk = "MEDIUM"
    else:
        risk = "HIGH"

    feasible = safe_end <= group["window_end"]

    if not feasible:
        warnings.append(
            "safety buffer goes past the requested window; rescheduling required"
        )

    if best["cost"] > separate:
        warnings.append(
            f"merging increases estimated cost by "
            f"{round(best['cost'] - separate, 1)}; review separate scheduling"
        )

    if not trains:
        warnings.append(
            "no train data for this section; cost is not meaningful"
        )

    request_ids = sorted(
        request.id for request in group["requests"]
    )

    proposal = {
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

    return proposal, None


# ---------- Conflict detection ----------

def _flag_conflicts(proposals):
    """Flag proposals overlapping in both location and buffered time."""
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
                first["conflicts_with"].append(second["proposal_id"])
                second["conflicts_with"].append(first["proposal_id"])

                first["warnings"].append(
                    f"overlaps {second['proposal_id']}: manual review"
                )
                second["warnings"].append(
                    f"overlaps {first['proposal_id']}: manual review"
                )


# ---------- Generate a read-only schedule ----------

def generate_schedule(db, section_id=None):
    output = {
        "proposals": [],
        "unschedulable": [],
        "warnings": [],
        "summary": {},
    }

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

    for sid, requests in requests_by_section.items():
        if sid not in sections:
            output["unschedulable"].extend(
                _reject(request, "unknown section")
                for request in requests
            )

    # Use the teammate's prediction module without modifying it.
    buffers = compute_buffers(db)

    if not buffers:
        output["warnings"].append(
            "no completed block history; risk is UNKNOWN"
        )

    for sid, section in sections.items():
        requests = requests_by_section.get(sid, [])

        if not requests:
            continue

        if not section.length_km or section.length_km <= 0:
            output["unschedulable"].extend(
                _reject(request, "section length missing")
                for request in requests
            )
            continue

        all_trains = db.query(Train).filter(
            Train.section_id == sid
        ).all()

        trains, skipped = _clean_trains(all_trains)

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

        for group in groups:
            try:
                proposal, reason = _build_proposal(
                    section,
                    trains,
                    buffers,
                    group,
                )
            except Exception as exc:
                proposal = None
                reason = f"scheduling error: {exc}"

            if proposal is not None:
                output["proposals"].append(proposal)
            else:
                output["unschedulable"].extend(
                    _reject(request, reason)
                    for request in group["requests"]
                )

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
            1 for p in proposals
            if p["merged_cost"] > p["separate_cost"]
        ),
    }

    return output


# ---------- Save proposals, never approve them ----------

def save_proposals(db, proposals, commit=True):
    """
    Save eligible proposals with status='proposed'.

    Infeasible proposals, conflicts, and already-assigned requests
    are skipped. Running this repeatedly avoids duplicate assignments.
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

            requests = db.query(Request).filter(
                Request.id.in_(request_ids)
            ).all()

            if (
                len(requests) != len(request_ids)
                or any(request.block_id is not None for request in requests)
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


def optimize(db, section_id=None):
    """POST /optimize ke liye. Read-only: kuch save nahi karta."""
    return generate_schedule(db, section_id)

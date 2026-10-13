# app/scheduler.py
# Recommends block schedules. It NEVER approves or starts a block: humans do that.
# generate_schedule()  -> read-only preview (no DB writes)
# save_proposals()     -> optional, stores proposals as status="proposed" (idempotent)

from app.models import Section, Train, Request, Block
from app.merge import merge_requests
from app.cost import group_cost, separate_cost, block_cost
from app.predict import build_history, train_model, predict_group

PENDING = "pending_human_approval"
MIN_HISTORY = 10        # fewer past events than this -> risk is "UNKNOWN"
MIN_WORK_SAMPLES = 5    # fewer samples for a work type -> warning


def hhmm(m):
    m = int(m)
    return f"{(m // 60) % 24:02d}:{m % 60:02d}" + (" (+1d)" if m >= 1440 else "")


# ---------- validation helpers ----------

def _request_problem(r, section_km):
    """Returns a reason string if the request can't be scheduled, else None."""
    if any(v is None for v in (r.km_from, r.km_to, r.duration_min,
                               r.window_start, r.window_end)):
        return "missing km, duration or time window"
    if r.km_to <= r.km_from:
        return "km_to must be greater than km_from"
    if r.km_from < 0 or r.km_to > section_km:
        return "km range outside the section"
    if r.duration_min <= 0:
        return "duration must be positive"
    if r.window_end - r.window_start < r.duration_min:
        return "time window shorter than the duration"
    return None


def _clean_trains(trains):
    good = [t for t in trains
            if t.entry_time is not None and t.exit_time is not None
            and t.exit_time > t.entry_time and t.weight is not None]
    return good, len(trains) - len(good)


def _reject(r, reason):
    return {"request_id": r.id, "dept": r.dept,
            "section_id": r.section_id, "reason": reason}


def _req_summary(r):
    return {"id": r.id, "dept": r.dept, "work_type": r.work_type,
            "km_from": r.km_from, "km_to": r.km_to,
            "duration_min": r.duration_min,
            "window_start": r.window_start, "window_end": r.window_end}


# ---------- one merged group -> one proposal ----------

def _build_proposal(section, trains, model, g):
    L = section.length_km
    best = group_cost(trains, L, g)
    if best is None:
        return None, "no feasible start time inside the shared window"

    pred = predict_group(model, g, start=best["start"])
    separate = separate_cost(trains, L, g["requests"])

    # cost if the block runs all the way to the safe (buffered) end
    worst_cost, worst_delay, _ = block_cost(
        trains, L, g["km_from"], g["km_to"], best["start"], pred["safe_end"])

    warnings = []
    history_n = model["_all"]["n"]
    risk = pred["risk"]
    if history_n < MIN_HISTORY:
        risk = "UNKNOWN"
        warnings.append("not enough history to predict overrun reliably")
    else:
        main = next((p for p in pred["per_work"]
                     if p["work_type"] == pred["main_risk_work"]), None)
        if main and main["samples"] < MIN_WORK_SAMPLES:
            warnings.append(f"limited history for {main['work_type']}")
    if pred["predicted_end"] > g["window_end"]:
        warnings.append("expected overrun goes past the requested window")
    elif pred["safe_end"] > g["window_end"]:
        warnings.append("safety buffer goes past the requested window")
    if not trains:
        warnings.append("no train data for this section; cost is not meaningful")

    ids = sorted(r.id for r in g["requests"])
    return {
        "proposal_id": f"S{section.id}-R" + "-".join(map(str, ids)),
        "section_id": section.id,
        "section_name": section.name,
        "request_ids": ids,
        "requests": [_req_summary(r) for r in g["requests"]],
        "depts": sorted({r.dept for r in g["requests"]}),
        "km_from": g["km_from"], "km_to": g["km_to"],
        "needs_power_block": g["needs_power_block"],
        "start": best["start"], "end": best["end"],
        "start_hhmm": hhmm(best["start"]), "end_hhmm": hhmm(best["end"]),
        "safe_end": pred["safe_end"], "safe_end_hhmm": hhmm(pred["safe_end"]),
        "merged_cost": best["cost"],
        "separate_cost": separate,
        "cost_saved": round(separate - best["cost"], 1),
        "train_delay_min": best["delay_min"],
        "affected_trains": best["affected"],
        "worst_case_cost": worst_cost,
        "risk": risk,
        "expected_overrun_min": pred["expected_overrun_min"],
        "suggested_buffer_min": pred["suggested_buffer_min"],
        "overrun_probability": pred["overrun_probability"],
        "likely_reason": pred["likely_reason"],
        "predicted_end": pred["predicted_end"],
        "status": PENDING,          # always; only a human can approve
        "conflicts_with": [],
        "warnings": warnings,
    }, None


def _flag_conflicts(proposals):
    """Two proposals in one section overlapping in km AND time (incl. buffer)."""
    for i, a in enumerate(proposals):
        for b in proposals[i + 1:]:
            if a["section_id"] != b["section_id"]:
                continue
            km = a["km_from"] < b["km_to"] and b["km_from"] < a["km_to"]
            tm = a["start"] < b["safe_end"] and b["start"] < a["safe_end"]
            if km and tm:
                a["conflicts_with"].append(b["proposal_id"])
                b["conflicts_with"].append(a["proposal_id"])
                a["warnings"].append(f"overlaps {b['proposal_id']}: manual review")
                b["warnings"].append(f"overlaps {a['proposal_id']}: manual review")


# ---------- main entry: READ-ONLY ----------

def generate_schedule(db, section_id=None):
    out = {"proposals": [], "unschedulable": [], "warnings": [], "summary": {}}

    sq = db.query(Section)
    if section_id is not None:
        sq = sq.filter(Section.id == section_id)
    sections = {s.id: s for s in sq.all()}
    if not sections:
        out["warnings"].append("no sections found")
        return out

    rq = db.query(Request).filter(Request.block_id.is_(None))
    if section_id is not None:
        rq = rq.filter(Request.section_id == section_id)
    by_section = {}
    for r in rq.all():
        by_section.setdefault(r.section_id, []).append(r)

    for sid, reqs in by_section.items():          # requests of unknown sections
        if sid not in sections and section_id is None:
            out["unschedulable"] += [_reject(r, "unknown section") for r in reqs]

    model = train_model(build_history(db))
    if model["_all"]["n"] == 0:
        out["warnings"].append("no overrun history: risk shown as UNKNOWN")

    for sid, section in sections.items():
        reqs = by_section.get(sid, [])
        if not reqs:
            continue
        if not section.length_km or section.length_km <= 0:
            out["unschedulable"] += [_reject(r, "section length missing") for r in reqs]
            continue

        trains, skipped = _clean_trains(
            db.query(Train).filter(Train.section_id == sid).all())
        if skipped:
            out["warnings"].append(f"{section.name}: {skipped} trains ignored (bad data)")

        valid = []
        for r in reqs:
            problem = _request_problem(r, section.length_km)
            if problem:
                out["unschedulable"].append(_reject(r, problem))
            else:
                valid.append(r)
        if not valid:
            continue

        try:
            groups = merge_requests(valid)
        except Exception as e:
            out["unschedulable"] += [_reject(r, f"merge failed: {e}") for r in valid]
            continue

        for g in groups:
            try:
                proposal, why = _build_proposal(section, trains, model, g)
            except Exception as e:
                proposal, why = None, f"scheduling error: {e}"
            if proposal:
                out["proposals"].append(proposal)
            else:
                out["unschedulable"] += [_reject(r, why) for r in g["requests"]]

    out["proposals"].sort(key=lambda p: (p["section_id"], p["start"]))
    _flag_conflicts(out["proposals"])

    P = out["proposals"]
    out["summary"] = {
        "proposals": len(P),
        "unschedulable_requests": len(out["unschedulable"]),
        "merged_cost": round(sum(p["merged_cost"] for p in P), 1),
        "separate_cost": round(sum(p["separate_cost"] for p in P), 1),
        "cost_saved": round(sum(p["cost_saved"] for p in P), 1),
        "high_risk": sum(1 for p in P if p["risk"] == "HIGH"),
        "with_conflicts": sum(1 for p in P if p["conflicts_with"]),
    }
    return out


# ---------- OPTIONAL: store proposals (never approves) ----------

def save_proposals(db, proposals, commit=True):
    """Creates Block(status='proposed') only for requests that are still unassigned.
    Running it twice is safe: assigned requests are skipped, so no duplicates."""
    saved, skipped = [], []
    try:
        for p in proposals:
            if p["conflicts_with"]:
                skipped.append({"proposal_id": p["proposal_id"], "reason": "conflict"})
                continue
            reqs = db.query(Request).filter(Request.id.in_(p["request_ids"])).all()
            if len(reqs) != len(p["request_ids"]) or any(r.block_id is not None for r in reqs):
                skipped.append({"proposal_id": p["proposal_id"],
                                "reason": "requests changed or already assigned"})
                continue
            block = Block(section_id=p["section_id"], start=p["start"],
                          end=p["end"], status="proposed")
            db.add(block)
            db.flush()
            for r in reqs:
                r.block_id = block.id
            saved.append({"proposal_id": p["proposal_id"], "block_id": block.id})
        if commit:
            db.commit()
    except Exception:
        db.rollback()
        raise
    return {"saved": saved, "skipped": skipped}
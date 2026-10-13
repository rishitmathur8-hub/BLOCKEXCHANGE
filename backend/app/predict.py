
from typing import Optional

K = 5


def _percentile(values, p):
    if not values:
        return 0

    s = sorted(values)
    idx = min(len(s) - 1, int(round(p * (len(s) - 1))))
    return s[idx]


def build_history(db):
    from app.models import BlockEvent, Block

    rows = []
    events = db.query(BlockEvent).all()

    for ev in events:
        if ev.actual_start is None or ev.actual_end is None:
            continue

        block = db.query(Block).filter(Block.id == ev.block_id).first()

        if not block or not block.requests:
            continue

        overrun = max(
            0,
            ev.actual_end - ev.actual_start - ev.granted_duration
        )

        rows.append({
            "work_type": block.requests[0].work_type,
            "overrun": overrun,
            "reason": ev.overrun_reason,
        })

    return rows


def _stats(rows):
    overruns = [r["overrun"] for r in rows]
    n = len(overruns)
    reasons = {}

    for r in rows:
        if r["reason"]:
            reasons[r["reason"]] = reasons.get(r["reason"], 0) + 1

    return {
        "n": n,
        "mean": sum(overruns) / n if n else 0,
        "p80": _percentile(overruns, 0.8),
        "p_overrun": (
            sum(1 for o in overruns if o > 0) / n if n else 0
        ),
        "top_reason": max(reasons, key=reasons.get) if reasons else None,
    }


def train_model(history):
    model = {"_all": _stats(history)}

    for wt in {r["work_type"] for r in history}:
        model[wt] = _stats([
            r for r in history if r["work_type"] == wt
        ])

    return model


def predict_work(model, work_type):
    g = model["_all"]
    s = model.get(work_type)

    # No historical records exist anywhere.
    # Keep numeric fields for scheduler compatibility, but explicitly
    # identify the prediction as unsupported by historical evidence.
    if g["n"] == 0:
        return {
            "work_type": work_type,
            "expected_overrun_min": 0,
            "buffer_min": 0,
            "overrun_probability": 0.0,
            "top_reason": None,
            "samples": 0,
            "data_status": "INSUFFICIENT_HISTORY",
        }

    # Use overall history when this work type has no samples.
    if not s or s["n"] == 0:
        s = g
        n = 0
        data_status = "GLOBAL_FALLBACK"
    else:
        n = s["n"]
        data_status = "WORK_TYPE_HISTORY"

    expected = (n * s["mean"] + K * g["mean"]) / (n + K)
    p_over = (n * s["p_overrun"] + K * g["p_overrun"]) / (n + K)

    buffer_value = max(s["p80"], expected)
    buffer_min = int(-(-buffer_value // 5) * 5)

    return {
        "work_type": work_type,
        "expected_overrun_min": round(expected),
        "buffer_min": buffer_min,
        "overrun_probability": round(p_over, 2),
        "top_reason": s["top_reason"],
        "samples": n,
        "data_status": data_status,
    }


def risk_level(expected, prob):
    if expected >= 25 or prob >= 0.85:
        return "HIGH"

    if expected >= 12 or prob >= 0.6:
        return "MEDIUM"

    return "LOW"


def predict_requests(model, requests, start, end):
    preds = [
        predict_work(model, r.work_type)
        for r in requests
    ]

    # Handle an empty request list without max() raising an exception.
    if not preds:
        return {
            "expected_overrun_min": 0,
            "suggested_buffer_min": 0,
            "overrun_probability": 0.0,
            "risk": "UNKNOWN",
            "main_risk_work": None,
            "likely_reason": None,
            "planned_end": end,
            "predicted_end": end,
            "safe_end": end,
            "per_work": [],
            "data_status": "NO_REQUESTS",
        }

    worst = max(
        preds,
        key=lambda p: p["expected_overrun_min"]
    )

    if model["_all"]["n"] == 0:
        data_status = "INSUFFICIENT_HISTORY"
        risk = "UNKNOWN"
    else:
        data_status = (
            "GLOBAL_FALLBACK"
            if any(p["data_status"] == "GLOBAL_FALLBACK" for p in preds)
            else "WORK_TYPE_HISTORY"
        )
        risk = risk_level(
            worst["expected_overrun_min"],
            worst["overrun_probability"],
        )

    return {
        "expected_overrun_min": worst["expected_overrun_min"],
        "suggested_buffer_min": worst["buffer_min"],
        "overrun_probability": worst["overrun_probability"],
        "risk": risk,
        "main_risk_work": worst["work_type"],
        "likely_reason": worst["top_reason"],
        "planned_end": end,
        "predicted_end": end + worst["expected_overrun_min"],
        "safe_end": end + worst["buffer_min"],
        "per_work": preds,
        "data_status": data_status,
    }


def predict_group(model, group, start: Optional[int] = None):
    s = group["window_start"] if start is None else start

    return predict_requests(
        model,
        group["requests"],
        s,
        s + group["duration_min"],
    )


def predict_block(model, block):
    return predict_requests(
        model,
        block.requests,
        block.start,
        block.end,
    )

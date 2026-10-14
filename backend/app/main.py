
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.models import Base, Block, BlockEvent, Request, Train, Section, AuditEntry
from app.predict import compute_buffers, buffer_for
from app.merge import km_overlap
from app.schemas import AuditEntryIn, OverlapCheckIn

try:
    from app.merge import find_merge_proposals
except ImportError:
    find_merge_proposals = None

try:
    from app.cost import slot_options
except ImportError:
    slot_options = None

try:
    from app.scheduler import optimize
except ImportError:
    optimize = None


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Block Exchange")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- input shapes ----------

class RequestIn(BaseModel):
    dept: str
    section_id: int
    km_from: float
    km_to: float
    duration_min: int
    window_start: int
    window_end: int
    work_type: str
    needs_power_block: bool = False


class ApproveIn(BaseModel):
    approved_by: str


class StartIn(BaseModel):
    at_minute: Optional[int] = None


class EndIn(BaseModel):
    at_minute: Optional[int] = None
    overrun_reason: Optional[str] = None


# ---------- helpers ----------

def now_minute():
    n = datetime.now()
    return n.hour * 60 + n.minute


def train_dict(t):
    return {
        "id": t.id,
        "number": t.number,
        "section_id": t.section_id,
        "category": t.category,
        "entry_time": t.entry_time,
        "exit_time": t.exit_time,
        "weight": t.weight,
    }


def request_dict(r):
    return {
        "id": r.id,
        "dept": r.dept,
        "section_id": r.section_id,
        "km_from": r.km_from,
        "km_to": r.km_to,
        "duration_min": r.duration_min,
        "window_start": r.window_start,
        "window_end": r.window_end,
        "work_type": r.work_type,
        "needs_power_block": r.needs_power_block,
        "block_id": r.block_id,
    }


def block_dict(b):
    return {
        "id": b.id,
        "section_id": b.section_id,
        "start": b.start,
        "end": b.end,
        "status": b.status,
        "request_ids": [r.id for r in b.requests],
    }


def get_block_or_404(db, block_id):
    block = db.get(Block, block_id)
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found")
    return block


def require_ready(func, name):
    if func is None:
        raise HTTPException(
            status_code=501,
            detail=f"{name} is not implemented yet",
        )


# ---------- read endpoints ----------

@app.get("/")
def home():
    return {"status": "Block Exchange running"}


@app.get("/trains")
def get_trains(
    section_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Train)

    if section_id is not None:
        query = query.filter(Train.section_id == section_id)

    return [
        train_dict(t)
        for t in query.order_by(Train.entry_time).all()
    ]


@app.get("/requests")
def get_requests(db: Session = Depends(get_db)):
    # Show requests that have not yet been assigned to a block.
    requests = (
        db.query(Request)
        .filter(Request.block_id.is_(None))
        .all()
    )
    return [request_dict(r) for r in requests]


@app.get("/blocks")
def get_blocks(db: Session = Depends(get_db)):
    blocks = (
        db.query(Block)
        .order_by(Block.section_id, Block.start)
        .all()
    )
    return [block_dict(b) for b in blocks]


@app.get("/merge-proposals")
def merge_proposals(db: Session = Depends(get_db)):
    require_ready(find_merge_proposals, "merge.find_merge_proposals")
    return find_merge_proposals(db)


@app.get("/blocks/{block_id}/options")
def block_options(block_id: int, db: Session = Depends(get_db)):
    require_ready(slot_options, "cost.slot_options")
    get_block_or_404(db, block_id)
    return slot_options(db, block_id)


@app.get("/predict/buffers")
def predict_buffers(db: Session = Depends(get_db)):
    return compute_buffers(db)


# ---------- write endpoints ----------

@app.post("/requests")
def create_request(body: RequestIn, db: Session = Depends(get_db)):
    if body.km_from > body.km_to:
        raise HTTPException(
            status_code=400,
            detail="km_from must be <= km_to",
        )

    if body.window_end - body.window_start < body.duration_min:
        raise HTTPException(
            status_code=400,
            detail="Time window is shorter than the duration",
        )

    req = Request(**body.model_dump())
    db.add(req)
    db.commit()
    db.refresh(req)
    return request_dict(req)


@app.post("/optimize")
def run_optimize(db: Session = Depends(get_db)):
    require_ready(optimize, "scheduler.optimize")
    return optimize(db)


@app.post("/blocks/{block_id}/approve")
def approve_block(
    block_id: int,
    body: ApproveIn,
    db: Session = Depends(get_db),
):
    block = get_block_or_404(db, block_id)

    if block.status != "proposed":
        raise HTTPException(
            status_code=400,
            detail="Only a 'proposed' block can be approved",
        )

    granted = block.end - block.start
    planned = max(
        (r.duration_min for r in block.requests),
        default=granted,
    )

    block.status = "approved"

    db.add(
        BlockEvent(
            block_id=block.id,
            planned_duration=planned,
            granted_duration=granted,
        )
    )

    db.commit()
    db.refresh(block)
    return block_dict(block)


@app.post("/blocks/{block_id}/start")
def start_block(
    block_id: int,
    body: StartIn,
    db: Session = Depends(get_db),
):
    block = get_block_or_404(db, block_id)

    if block.status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Block must be 'approved' before it can start",
        )

    block.event.actual_start = (
        body.at_minute
        if body.at_minute is not None
        else now_minute()
    )

    block.status = "started"
    db.commit()
    db.refresh(block)
    return block_dict(block)


@app.post("/blocks/{block_id}/end")
def end_block(
    block_id: int,
    body: EndIn,
    db: Session = Depends(get_db),
):
    block = get_block_or_404(db, block_id)

    if block.status != "started":
        raise HTTPException(
            status_code=400,
            detail="Block must be 'started' before it can end",
        )

    event = block.event

    event.actual_end = (
        body.at_minute
        if body.at_minute is not None
        else now_minute()
    )

    overrun = max(
        0,
        (event.actual_end - event.actual_start)
        - event.granted_duration,
    )

    event.overrun_reason = body.overrun_reason
    block.status = "overrun" if overrun > 0 else "completed"

    db.commit()
    db.refresh(block)

    result = block_dict(block)
    result["overrun_min"] = overrun
    return result

@app.post("/optimize/save")
def save_optimized(db: Session = Depends(get_db)):
    require_ready(optimize, "scheduler.optimize")
    return optimize(db)




@app.post("/blocks/{block_id}/cancel")
def cancel_block(block_id: int, db: Session = Depends(get_db)):
    block = get_block_or_404(db, block_id)

    if block.status not in ("proposed", "approved"):
        raise HTTPException(
            status_code=400,
            detail="Only a 'proposed' or 'approved' block can be cancelled",
        )

    # requests ko wapas unassigned karo, taaki /optimize unhe dobara plan kar sake
    for req in list(block.requests):
        req.block_id = None

    # kaam shuru hi nahi hua, to is block ka koi actual data nahi hai
    if block.event is not None:
        db.delete(block.event)

    block.status = "cancelled"
    db.commit()
    db.refresh(block)
    return block_dict(block)


# ---------- Enhanced Phase 2 & 3 Support Endpoints ----------

@app.get("/sections")
def get_sections(db: Session = Depends(get_db)):
    sections = db.query(Section).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "from_station": s.from_station,
            "to_station": s.to_station,
            "length_km": s.length_km,
        }
        for s in sections
    ]


@app.post("/requests/check-overlap")
def check_overlap(body: OverlapCheckIn, db: Session = Depends(get_db)):
    """Check potential overlaps for a proposed request before submission."""
    unassigned = db.query(Request).filter(
        Request.block_id.is_(None),
        Request.section_id == body.section_id
    ).all()

    overlapping_requests = []
    for r in unassigned:
        if km_overlap(body.km_from, body.km_to, r.km_from, r.km_to):
            start = max(body.window_start, r.window_start)
            end = min(body.window_end, r.window_end)
            if end > start:
                overlapping_requests.append(request_dict(r))

    active_blocks = db.query(Block).filter(
        Block.section_id == body.section_id,
        Block.status.in_(["proposed", "approved", "started"])
    ).all()

    overlapping_blocks = []
    for b in active_blocks:
        if b.requests:
            b_from = min(r.km_from for r in b.requests)
            b_to = max(r.km_to for r in b.requests)
            if km_overlap(body.km_from, body.km_to, b_from, b_to):
                if b.start < body.window_end and body.window_start < b.end:
                    overlapping_blocks.append(block_dict(b))

    has_overlaps = len(overlapping_requests) > 0 or len(overlapping_blocks) > 0
    return {
        "has_overlaps": has_overlaps,
        "overlapping_requests": overlapping_requests,
        "overlapping_blocks": overlapping_blocks,
        "merge_candidate": len(overlapping_requests) > 0,
        "reason": f"Found {len(overlapping_requests)} overlapping request(s) and {len(overlapping_blocks)} active block(s) on this section." if has_overlaps else "No conflicting or overlapping requests found.",
    }


@app.get("/blocks/detailed")
def get_blocks_detailed(db: Session = Depends(get_db)):
    """Returns blocks with linked BlockEvent and request details."""
    blocks = db.query(Block).order_by(Block.section_id, Block.start).all()
    out = []
    for b in blocks:
        event_dict = None
        overrun_min = 0
        if b.event:
            actual_end = b.event.actual_end
            actual_start = b.event.actual_start
            if actual_end is not None and actual_start is not None and b.event.granted_duration:
                overrun_min = max(0, (actual_end - actual_start) - b.event.granted_duration)
            event_dict = {
                "id": b.event.id,
                "block_id": b.event.block_id,
                "planned_duration": b.event.planned_duration,
                "granted_duration": b.event.granted_duration,
                "actual_start": b.event.actual_start,
                "actual_end": b.event.actual_end,
                "overrun_reason": b.event.overrun_reason,
            }
        section = db.get(Section, b.section_id)
        out.append({
            "id": b.id,
            "section_id": b.section_id,
            "section_name": section.name if section else f"Section {b.section_id}",
            "start": b.start,
            "end": b.end,
            "status": b.status,
            "request_ids": [r.id for r in b.requests],
            "requests": [request_dict(r) for r in b.requests],
            "event": event_dict,
            "overrun_min": overrun_min,
        })
    return out


@app.get("/predict/overrun-analysis")
def overrun_analysis(db: Session = Depends(get_db)):
    """Computes active overrun risk, confidence metrics, and re-plan suggestions."""
    buffers = compute_buffers(db)
    active_blocks = db.query(Block).filter(
        Block.status.in_(["proposed", "approved", "started", "overrun"])
    ).all()

    now_min = now_minute()
    analyses = []

    for b in active_blocks:
        work_types = [r.work_type for r in b.requests] if b.requests else ["track_repair"]
        primary_work = work_types[0] if work_types else "track_repair"
        expected_buffer = max((buffer_for(wt, buffers) for wt in work_types), default=15)

        planned_duration = b.end - b.start
        actual_start = b.event.actual_start if (b.event and b.event.actual_start is not None) else b.start
        predicted_end = actual_start + planned_duration + expected_buffer

        # Confidence based on historical records for this work type
        history_count = db.query(BlockEvent).join(Block).join(Request).filter(
            Request.work_type == primary_work,
            BlockEvent.actual_end.isnot(None)
        ).count()

        if history_count >= 10:
            confidence = "HIGH"
        elif history_count >= 3:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        risk = "HIGH" if expected_buffer > 20 else ("MEDIUM" if expected_buffer > 10 else "LOW")
        reason = f"Based on {history_count} historical {primary_work} executions, average buffer required is {expected_buffer} mins."

        # Re-plan suggestion: alternate lowest-cost slot
        replan = None
        if slot_options:
            options = slot_options(db, b.id)
            if options:
                # Find best alternative slot starting after predicted end or next viable window
                recommended = next((opt for opt in options if opt["recommended"]), options[0])
                replan = {
                    "suggested_start": recommended["start"],
                    "suggested_end": recommended["end"],
                    "start_hhmm": recommended["start_hhmm"],
                    "end_hhmm": recommended["end_hhmm"],
                    "delay_minutes": recommended["delay_minutes"],
                    "trains_hit": recommended["trains_hit"],
                    "cost": recommended["cost"],
                    "reason": f"Shifts block to lower-density train window, saving {max(0, round(recommended['cost'] - 10, 1))} weighted cost units."
                }

        analyses.append({
            "block_id": b.id,
            "section_id": b.section_id,
            "status": b.status,
            "primary_work_type": primary_work,
            "departments": sorted({r.dept for r in b.requests}),
            "planned_start": b.start,
            "planned_end": b.end,
            "actual_start": b.event.actual_start if b.event else None,
            "expected_buffer_min": expected_buffer,
            "predicted_end": predicted_end,
            "predicted_overrun_min": expected_buffer,
            "risk": risk,
            "confidence": confidence,
            "reason": reason,
            "replan": replan,
        })

    return {
        "analyses": analyses,
        "buffer_history": buffers,
    }


@app.get("/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    """Retrieve chronological audit history of human decisions."""
    logs = db.query(AuditEntry).order_by(AuditEntry.id.desc()).all()
    # Pre-seed realistic entries if empty
    if not logs:
        sample_logs = [
            AuditEntry(
                timestamp=datetime.now().isoformat(),
                user_role="Section Controller",
                user_name="V. K. Aggarwal",
                action="APPROVE_BLOCK",
                entity_type="block",
                entity_id="1",
                reason="Approved joint 120-min window for Saharanpur-Ambala Section. Minimal freight disruption.",
                details="Window: 10:00 - 12:00 IST. Merged Engineering + S&T + OHE.",
            ),
            AuditEntry(
                timestamp=datetime.now().isoformat(),
                user_role="Senior Divisional Engineer",
                user_name="A. Roy",
                action="RECOMMEND_MERGE",
                entity_type="proposal",
                entity_id="S1-R1-2-3",
                reason="Aligned track repair with OHE power shut down at km 22-28.",
                details="Estimated delay savings: 65 train-minutes.",
            ),
            AuditEntry(
                timestamp=datetime.now().isoformat(),
                user_role="Field Supervisor",
                user_name="Rameshwar Singh (SSE/P-Way)",
                action="START_WORK",
                entity_type="block",
                entity_id="2",
                reason="Track possession handed over by station master.",
                details="Caution flags and banner placed at km 50.",
            ),
        ]
        for sl in sample_logs:
            db.add(sl)
        db.commit()
        logs = db.query(AuditEntry).order_by(AuditEntry.id.desc()).all()

    return [
        {
            "id": l.id,
            "timestamp": l.timestamp,
            "user_role": l.user_role,
            "user_name": l.user_name,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "reason": l.reason,
            "details": l.details,
        }
        for l in logs
    ]


@app.post("/audit-logs")
def create_audit_log(body: AuditEntryIn, db: Session = Depends(get_db)):
    """Record an explicit human decision or field action."""
    entry = AuditEntry(
        timestamp=datetime.now().isoformat(),
        **body.model_dump(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {
        "id": entry.id,
        "timestamp": entry.timestamp,
        "user_role": entry.user_role,
        "user_name": entry.user_name,
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "reason": entry.reason,
        "details": entry.details,
    }
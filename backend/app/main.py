from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.models import Base, Block, BlockEvent, Request, Train
from app.predict import compute_buffers

# Functions written by teammates. If their file isn't ready yet, we don't crash.
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

Base.metadata.create_all(bind=engine)  # creates tables if they don't exist

app = FastAPI(title="Block Exchange")

# Lets the React frontend (a different port) talk to this backend
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
    return {"id": t.id, "number": t.number, "section_id": t.section_id,
            "category": t.category, "entry_time": t.entry_time,
            "exit_time": t.exit_time, "weight": t.weight}


def request_dict(r):
    return {"id": r.id, "dept": r.dept, "section_id": r.section_id,
            "km_from": r.km_from, "km_to": r.km_to, "duration_min": r.duration_min,
            "window_start": r.window_start, "window_end": r.window_end,
            "work_type": r.work_type, "needs_power_block": r.needs_power_block,
            "block_id": r.block_id}


def block_dict(b):
    return {"id": b.id, "section_id": b.section_id, "start": b.start,
            "end": b.end, "status": b.status,
            "request_ids": [r.id for r in b.requests]}


def get_block_or_404(db, block_id):
    block = db.get(Block, block_id)
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found")
    return block


def require_ready(func, name):
    if func is None:
        raise HTTPException(status_code=501, detail=f"{name} is not implemented yet")


# ---------- read endpoints ----------
@app.get("/")
def home():
    return {"status": "Block Exchange running"}


@app.get("/trains")
def get_trains(section_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Train)
    if section_id is not None:
        query = query.filter(Train.section_id == section_id)
    return [train_dict(t) for t in query.all()]


@app.get("/requests")
def get_requests(db: Session = Depends(get_db)):
    return [request_dict(r) for r in db.query(Request).all()]


@app.get("/blocks")
def get_blocks(db: Session = Depends(get_db)):
    return [block_dict(b) for b in db.query(Block).all()]


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
        raise HTTPException(status_code=400, detail="km_from must be <= km_to")
    if body.window_end - body.window_start < body.duration_min:
        raise HTTPException(status_code=400, detail="Time window is shorter than the duration")
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
def approve_block(block_id: int, body: ApproveIn, db: Session = Depends(get_db)):
    block = get_block_or_404(db, block_id)
    if block.status != "proposed":
        raise HTTPException(status_code=400, detail="Only a 'proposed' block can be approved")
    granted = block.end - block.start
    planned = max((r.duration_min for r in block.requests), default=granted)
    block.status = "approved"
    db.add(BlockEvent(block_id=block.id, planned_duration=planned, granted_duration=granted))
    db.commit()
    db.refresh(block)
    return block_dict(block)


@app.post("/blocks/{block_id}/start")
def start_block(block_id: int, body: StartIn, db: Session = Depends(get_db)):
    block = get_block_or_404(db, block_id)
    if block.status != "approved":
        raise HTTPException(status_code=400, detail="Block must be 'approved' before it can start")
    block.event.actual_start = body.at_minute if body.at_minute is not None else now_minute()
    block.status = "started"
    db.commit()
    db.refresh(block)
    return block_dict(block)


@app.post("/blocks/{block_id}/end")
def end_block(block_id: int, body: EndIn, db: Session = Depends(get_db)):
    block = get_block_or_404(db, block_id)
    if block.status != "started":
        raise HTTPException(status_code=400, detail="Block must be 'started' before it can end")
    event = block.event
    event.actual_end = body.at_minute if body.at_minute is not None else now_minute()
    overrun = max(0, (event.actual_end - event.actual_start) - event.granted_duration)
    event.overrun_reason = body.overrun_reason
    block.status = "overrun" if overrun > 0 else "completed"
    db.commit()
    db.refresh(block)
    result = block_dict(block)
    result["overrun_min"] = overrun
    return result
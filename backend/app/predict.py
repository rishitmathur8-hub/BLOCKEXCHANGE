from collections import defaultdict

from app.models import BlockEvent


def average_overrun(rows):
    """rows = list of (work_type, granted_min, actual_min).
    Returns {work_type: average overrun in minutes}."""
    groups = defaultdict(list)
    for work_type, granted, actual in rows:
        groups[work_type].append(max(0, actual - granted))  # early finish = 0 overrun
    return {wt: round(sum(v) / len(v)) for wt, v in groups.items()}


def compute_buffers(db):
    """Reads finished BlockEvents from the database and returns average overrun per work type."""
    events = (
        db.query(BlockEvent)
        .filter(BlockEvent.actual_start.isnot(None), BlockEvent.actual_end.isnot(None))
        .all()
    )
    rows = []
    for e in events:
        if e.block is None or not e.block.requests:
            continue
        work_type = e.block.requests[0].work_type
        rows.append((work_type, e.granted_duration, e.actual_end - e.actual_start))
    return average_overrun(rows)


def buffer_for(work_type, buffers):
    """Extra minutes to add for a work type (0 if we have no history)."""
    return buffers.get(work_type, 0)
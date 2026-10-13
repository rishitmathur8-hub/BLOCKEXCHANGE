from app.models import Block, Request


# ---------- Part 1: merge logic ----------

def km_overlap(a_from, a_to, b_from, b_to):
    # True agar do km ranges track ka kuch hissa share karte hain
    return a_from < b_to and b_from < a_to


def can_join(group, req):
    # same section?
    if group["section_id"] != req.section_id:
        return False

    # same stretch of track?
    if not km_overlap(group["km_from"], group["km_to"], req.km_from, req.km_to):
        return False

    # common time window mein sabse lamba kaam fit hona chahiye
    start = max(group["window_start"], req.window_start)
    end = min(group["window_end"], req.window_end)
    duration = max(group["duration_min"], req.duration_min)
    return end - start >= duration


def new_group(req):
    return {
        "section_id": req.section_id,
        "km_from": req.km_from,
        "km_to": req.km_to,
        "window_start": req.window_start,
        "window_end": req.window_end,
        "duration_min": req.duration_min,
        "needs_power_block": req.needs_power_block,
        "requests": [req],
    }


def add_to_group(group, req):
    group["km_from"] = min(group["km_from"], req.km_from)
    group["km_to"] = max(group["km_to"], req.km_to)
    group["window_start"] = max(group["window_start"], req.window_start)
    group["window_end"] = min(group["window_end"], req.window_end)
    group["duration_min"] = max(group["duration_min"], req.duration_min)
    group["needs_power_block"] = group["needs_power_block"] or req.needs_power_block
    group["requests"].append(req)


def merge_requests(requests):
    groups = []
    for req in sorted(requests, key=lambda r: (r.section_id, r.window_start)):
        for g in groups:
            if can_join(g, req):
                add_to_group(g, req)
                break
        else:
            groups.append(new_group(req))
    return groups


# ---------- Part 2: database mein save karna ----------

def save_blocks(db, groups):
    # har merged group se ek "proposed" Block banao
    blocks = []
    for g in groups:
        block = Block(
            section_id=g["section_id"],
            start=g["window_start"],
            end=g["window_start"] + g["duration_min"],
            status="proposed",
        )
        db.add(block)
        db.flush()  # commit ke bina block.id mil jaye
        for req in g["requests"]:
            req.block_id = block.id
        blocks.append(block)
    db.commit()
    return blocks


def run_merge(db):
    # sirf wahi requests jo abhi kisi block mein nahi gayi
    reqs = db.query(Request).filter(Request.block_id.is_(None)).all()
    groups = merge_requests(reqs)
    return save_blocks(db, groups)


# ---------- Part 3: API ke liye (main.py isi ko bulata hai) ----------

def find_merge_proposals(db):
    # naye requests ko merge karke "proposed" blocks banao (agar koi naya ho)
    run_merge(db)

    # jo bhi abhi "proposed" hain, wo sab return karo
    proposed = (
        db.query(Block)
        .filter(Block.status == "proposed")
        .order_by(Block.start)
        .all()
    )

    return [
        {
            "block_id": b.id,
            "section_id": b.section_id,
            "start": b.start,
            "end": b.end,
            "depts": sorted({r.dept for r in b.requests}),
            "needs_power_block": any(r.needs_power_block for r in b.requests),
            "requests": [
                {
                    "id": r.id,
                    "dept": r.dept,
                    "km_from": r.km_from,
                    "km_to": r.km_to,
                    "duration_min": r.duration_min,
                    "window_start": r.window_start,
                    "window_end": r.window_end,
                    "work_type": r.work_type,
                    "needs_power_block": r.needs_power_block,
                }
                for r in b.requests
            ],
        }
        for b in proposed
    ]
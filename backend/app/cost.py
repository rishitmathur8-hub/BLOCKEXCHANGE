# app/cost.py
# Cost = sum(train weight x delay minutes) for trains that cannot
# pass through the maintenance zone during the block.
#
# Conservative waiting model:
# If a train's passage through the work zone overlaps the block,
# it waits until the block ends.
# Assumption: each train moves at constant speed through the section.

STEP = 15  # Minutes between candidate block start times


def passing_time(train, section_km, km):
    """Estimate when a train reaches a kilometre position."""
    run = train.exit_time - train.entry_time
    return train.entry_time + run * (km / section_km)


def train_delay(train, section_km, km_from, km_to, start, end):
    """
    Estimate delay under the conservative waiting model.

    If the train's passage interval does not overlap the maintenance
    block, there is no delay. Otherwise, the train waits until the
    block ends, and delay is measured from its estimated arrival at
    the affected zone.

    This is a simplified planning assumption, not a railway
    signalling or operational safety model.
    """
    t_in = passing_time(train, section_km, km_from)
    run = train.exit_time - train.entry_time
    t_out = t_in + run * ((km_to - km_from) / section_km)

    # The train clears the zone before the block starts, or arrives
    # after the block has ended.
    if t_out <= start or t_in >= end:
        return 0

    # Conservative assumption: the train cannot proceed until the
    # maintenance block ends.
    return max(0, end - t_in)


def block_cost(trains, section_km, km_from, km_to, start, end):
    """Return (total weighted cost, total delay, affected trains)."""
    total_cost = 0
    total_delay = 0
    affected = []

    for t in trains:
        delay = train_delay(
            t, section_km, km_from, km_to, start, end
        )

        if delay > 0:
            total_cost += delay * t.weight
            total_delay += delay
            affected.append({
                "train": t.number,
                "category": t.category,
                "delay_min": round(delay),
            })

    return round(total_cost, 1), round(total_delay, 1), affected


def best_start(trains, section_km, km_from, km_to,
               duration, w_start, w_end):
    """Find the lowest-cost start time within the allowed window."""
    best = None
    start = w_start

    while start + duration <= w_end:
        cost, delay, affected = block_cost(
            trains, section_km, km_from, km_to,
            start, start + duration
        )

        if best is None or cost < best["cost"]:
            best = {
                "start": start,
                "end": start + duration,
                "cost": cost,
                "delay_min": delay,
                "affected": affected,
            }

        start += STEP

    return best


def group_cost(trains, section_km, group):
    """Calculate the cost of one merged maintenance group."""
    return best_start(
        trains,
        section_km,
        group["km_from"],
        group["km_to"],
        group["duration_min"],
        group["window_start"],
        group["window_end"],
    )


def separate_cost(trains, section_km, requests):
    """Calculate the sum of independently optimized request costs."""
    total = 0

    for request in requests:
        result = best_start(
            trains,
            section_km,
            request.km_from,
            request.km_to,
            request.duration_min,
            request.window_start,
            request.window_end,
        )

        if result:
            total += result["cost"]

    return round(total, 1)


# ---------- NEW: GET /blocks/{id}/options ke liye ----------

def _hhmm(minutes):
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def slot_options(db, block_id):
    """
    Ek block ke liye har possible start time ki delay-cost table.
    main.py ka GET /blocks/{id}/options isi ko bulata hai.
    """
    from app.models import Block, Section, Train

    block = db.get(Block, block_id)
    if block is None or not block.requests:
        return []

    section = db.get(Section, block.section_id)
    trains = (
        db.query(Train)
        .filter(Train.section_id == block.section_id)
        .all()
    )

    # merged block ki shape requests se nikalo (merge.py jaisa hi rule)
    reqs = block.requests
    km_from = min(r.km_from for r in reqs)
    km_to = max(r.km_to for r in reqs)
    w_start = max(r.window_start for r in reqs)
    w_end = min(r.window_end for r in reqs)
    duration = max(r.duration_min for r in reqs)

    options = []
    start = w_start
    while start + duration <= w_end:
        cost, delay, affected = block_cost(
            trains, section.length_km, km_from, km_to,
            start, start + duration,
        )
        options.append({
            "start": start,
            "end": start + duration,
            "start_hhmm": _hhmm(start),
            "end_hhmm": _hhmm(start + duration),
            "cost": cost,
            "delay_minutes": delay,
            "trains_hit": len(affected),
            "affected": affected,
            "recommended": False,
        })
        start += STEP

    if options:
        min(options, key=lambda o: o["cost"])["recommended"] = True

    return options
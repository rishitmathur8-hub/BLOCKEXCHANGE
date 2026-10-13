# app/cost.py
# Cost = sum(train weight x delay minutes) for trains that get blocked.
# Assumption: each train moves at constant speed through the section.

STEP = 15  # minutes, step used when searching for the best start time


def passing_time(train, section_km, km):
    """Minute at which the train reaches `km`."""
    run = train.exit_time - train.entry_time
    return train.entry_time + run * (km / section_km)


def train_delay(train, section_km, km_from, km_to, start, end):
    """Delay in minutes if the block [start, end] covers km_from-km_to."""
    run = train.exit_time - train.entry_time
    t_in = passing_time(train, section_km, km_from)
    t_out = t_in + run * ((km_to - km_from) / section_km)

    # train is not in the block zone during the block time -> no delay
    if t_out <= start or t_in >= end:
        return 0
    # otherwise it waits until the block ends
    return max(0, end - t_in)


def block_cost(trains, section_km, km_from, km_to, start, end):
    """Returns (total_cost, total_delay_min, affected_trains)."""
    total_cost = 0
    total_delay = 0
    affected = []
    for t in trains:
        d = train_delay(t, section_km, km_from, km_to, start, end)
        if d > 0:
            total_cost += d * t.weight
            total_delay += d
            affected.append({"train": t.number, "category": t.category,
                             "delay_min": round(d)})
    return round(total_cost, 1), round(total_delay, 1), affected


def best_start(trains, section_km, km_from, km_to, duration, w_start, w_end):
    """Slide the block through the allowed window, return the cheapest start."""
    best = None
    start = w_start
    while start + duration <= w_end:
        cost, delay, aff = block_cost(trains, section_km, km_from, km_to,
                                      start, start + duration)
        if best is None or cost < best["cost"]:
            best = {"start": start, "end": start + duration, "cost": cost,
                    "delay_min": delay, "affected": aff}
        start += STEP
    return best  # None if the window is too small


def group_cost(trains, section_km, group):
    """Cost of ONE merged group (dict from merge.py), at its best start."""
    return best_start(trains, section_km, group["km_from"], group["km_to"],
                      group["duration_min"], group["window_start"],
                      group["window_end"])


def separate_cost(trains, section_km, requests):
    """Cost if every request was done as its own block (no merge)."""
    total = 0
    for r in requests:
        b = best_start(trains, section_km, r.km_from, r.km_to,
                       r.duration_min, r.window_start, r.window_end)
        if b:
            total += b["cost"]
    return round(total, 1)
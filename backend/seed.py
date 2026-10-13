import random

from app.database import engine, SessionLocal
from app.models import Base, Section, Train, Request, Block, BlockEvent

random.seed(42)  # har baar same data, taaki team ka data match kare

# ---------- TRAINS ----------
CATEGORIES = {
    "Rajdhani":  {"count": 2,  "weight": 5, "run": 55},
    "Express":   {"count": 10, "weight": 3, "run": 75},
    "Passenger": {"count": 16, "weight": 2, "run": 110},
    "Freight":   {"count": 12, "weight": 1, "run": 130},
}
PREFIX = {"Rajdhani": "12", "Express": "14", "Passenger": "54", "Freight": "FR"}

# ---------- LIVE REQUESTS ----------
# (dept, km_from, km_to, duration_min, window_start, window_end, work_type, needs_power_block)
# time minutes mein: 600 = 10:00, 960 = 16:00
LIVE_REQUESTS = [
    # Group A: km 20-30, teeno overlap
    ("Engineering", 22, 28, 120, 600, 960, "track_repair", False),
    ("S&T",         25, 30,  90, 630, 960, "signal_work", False),
    ("OHE",         20, 26,  90, 600, 900, "ohe_work", True),
    # Group B: km 50-58
    ("Engineering", 50, 56,  90, 780, 1080, "rail_welding", False),
    ("S&T",         54, 58,  60, 780, 1020, "point_maintenance", False),
    # Group C: km 70-78
    ("Engineering", 70, 75, 120, 660, 960, "ballast_work", False),
    ("OHE",         72, 78,  90, 660, 900, "ohe_work", True),
    # Akele requests (kisi se overlap nahi)
    ("S&T",          5,  8,  60, 600, 840, "signal_work", False),
    ("Engineering", 40, 44,  90, 840, 1140, "track_repair", False),
    ("OHE",         82, 85,  60, 900, 1140, "ohe_work", True),
    ("Engineering", 10, 14,  60, 120, 300, "rail_welding", False),   # raat ka kaam
    ("S&T",         33, 36,  60, 600, 900, "signal_work", False),
]

# ---------- PURANA HISTORY ----------
# work_type: (dept, average overrun min, spread)
WORK = {
    "track_repair":      ("Engineering", 25, 10),
    "rail_welding":      ("Engineering", 30, 12),
    "ballast_work":      ("Engineering", 35, 15),
    "signal_work":       ("S&T", 12, 6),
    "point_maintenance": ("S&T", 10, 5),
    "ohe_work":          ("OHE", 18, 8),
}
REASONS = ["material late", "crew shortage", "equipment failure",
           "unexpected defect", "permission delay"]


def make_entry_time(category, run):
    if category == "Freight":
        entry = random.randint(0, 1439)
    else:
        entry = random.randint(300, 1380)
    return min(entry, 1439 - run)


def seed_trains(db, section_id):
    used = set()
    for category, info in CATEGORIES.items():
        for _ in range(info["count"]):
            number = PREFIX[category] + str(random.randint(100, 999))
            while number in used:
                number = PREFIX[category] + str(random.randint(100, 999))
            used.add(number)
            entry = make_entry_time(category, info["run"])
            db.add(Train(
                number=number, section_id=section_id, category=category,
                entry_time=entry, exit_time=entry + info["run"],
                weight=info["weight"],
            ))


def seed_live_requests(db, section_id):
    for dept, kf, kt, dur, ws, we, wt, power in LIVE_REQUESTS:
        db.add(Request(
            dept=dept, section_id=section_id, km_from=kf, km_to=kt,
            duration_min=dur, window_start=ws, window_end=we,
            work_type=wt, needs_power_block=power,
            block_id=None,   # abhi merge nahi hui
        ))


def seed_history(db, section_id, n=50):
    work_types = list(WORK.keys())
    for _ in range(n):
        wt = random.choice(work_types)
        dept, mean, spread = WORK[wt]

        planned = random.choice([60, 90, 120])
        granted = planned if random.random() < 0.7 else planned - 15
        start = random.randrange(600, 901, 15)

        overrun = max(0, round(random.gauss(mean, spread)))
        if random.random() < 0.25:      # kuch blocks time pe khatam hote hain
            overrun = 0

        block = Block(
            section_id=section_id, start=start, end=start + granted,
            status="overrun" if overrun > 0 else "completed",
        )
        db.add(block)
        db.flush()   # block.id mil jaye, commit ke bina

        km = round(random.uniform(0, 78), 1)
        db.add(Request(
            dept=dept, section_id=section_id,
            km_from=km, km_to=round(km + random.uniform(2, 6), 1),
            duration_min=planned, window_start=start,
            window_end=start + granted + 60, work_type=wt,
            needs_power_block=(wt == "ohe_work"),
            block_id=block.id,   # purani request, block se juda hua
        ))

        actual_start = start + random.randint(0, 10)
        db.add(BlockEvent(
            block_id=block.id, planned_duration=planned,
            granted_duration=granted, actual_start=actual_start,
            actual_end=actual_start + granted + overrun,
            overrun_reason=random.choice(REASONS) if overrun > 0 else None,
        ))


def seed():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    db = SessionLocal()
    section = Section(name="Saharanpur-Ambala", from_station="Saharanpur",
                      to_station="Ambala", length_km=85.0)
    db.add(section)
    db.commit()

    seed_trains(db, section.id)
    seed_live_requests(db, section.id)
    seed_history(db, section.id)
    db.commit()
    db.close()
    print("Seed complete: 1 section, 40 trains, 12 live requests, 50 history blocks")


if __name__ == "__main__":
    seed()
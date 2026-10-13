import random

from app.database import engine, SessionLocal
from app.models import Base, Section, Train

random.seed(42)  # har baar same data aaye, taaki team ka data match kare

# category: kitni trains, priority weight, section paar karne ke minute
CATEGORIES = {
    "Rajdhani":  {"count": 2,  "weight": 5, "run": 55},
    "Express":   {"count": 10, "weight": 3, "run": 75},
    "Passenger": {"count": 16, "weight": 2, "run": 110},
    "Freight":   {"count": 12, "weight": 1, "run": 130},
}

PREFIX = {"Rajdhani": "12", "Express": "14", "Passenger": "54", "Freight": "FR"}


def make_entry_time(category, run):
    """Din ke shuru se minutes mein, section mein ghusne ka time."""
    if category == "Freight":
        entry = random.randint(0, 1439)        # freight poore din/raat chalti hai
    else:
        entry = random.randint(300, 1380)      # baaki 05:00 se 23:00 ke beech
    return min(entry, 1439 - run)              # din ke andar hi khatam ho


def seed():
    # purane tables hata ke naye banao, taaki seed dobara chalane pe duplicate na ho
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    db = SessionLocal()

    section = Section(
        name="Saharanpur-Ambala",
        from_station="Saharanpur",
        to_station="Ambala",
        length_km=85.0,
    )
    db.add(section)
    db.commit()  # commit ke baad section.id mil jati hai

    used_numbers = set()
    for category, info in CATEGORIES.items():
        for _ in range(info["count"]):
            number = PREFIX[category] + str(random.randint(100, 999))
            while number in used_numbers:
                number = PREFIX[category] + str(random.randint(100, 999))
            used_numbers.add(number)

            entry = make_entry_time(category, info["run"])
            db.add(Train(
                number=number,
                section_id=section.id,
                category=category,
                entry_time=entry,
                exit_time=entry + info["run"],
                weight=info["weight"],
            ))

    db.commit()
    db.close()
    print("Seed complete: 1 section, 40 trains")


if __name__ == "__main__":
    seed()
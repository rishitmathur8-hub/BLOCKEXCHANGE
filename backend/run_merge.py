from app.database import get_db
from app.merge import run_merge

db = next(get_db())
blocks = run_merge(db)

print(len(blocks), "blocks saved")
for b in blocks:
    print("block", b.id, "| section", b.section_id, "| start", b.start, "| end", b.end, "|", b.status, "|", len(b.requests), "requests")
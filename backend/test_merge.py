from app.database import get_db
from app.models import Request
from app.merge import merge_requests

db = next(get_db())
reqs = db.query(Request).filter(Request.block_id.is_(None)).all()
groups = merge_requests(reqs)

print(len(reqs), "requests ->", len(groups), "blocks")
for g in groups:
    print(
        "section", g["section_id"],
        "| km", g["km_from"], "-", g["km_to"],
        "| duration", g["duration_min"],
        "| requests merged:", len(g["requests"]),
    )
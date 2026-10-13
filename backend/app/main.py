from typing import List

from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Block, Request, Train
from app.schemas import BlockOut, RequestOut, TrainOut

app = FastAPI(title="Block Exchange")


@app.get("/")
def home():
    return {"status": "Block Exchange running"}


@app.get("/trains", response_model=List[TrainOut])
def get_trains(db: Session = Depends(get_db)):
    return db.query(Train).order_by(Train.entry_time).all()


@app.get("/requests", response_model=List[RequestOut])
def get_requests(db: Session = Depends(get_db)):
    # only live requests: not merged into any block yet
    return db.query(Request).filter(Request.block_id.is_(None)).all()


@app.get("/blocks", response_model=List[BlockOut])
def get_blocks(db: Session = Depends(get_db)):
    # joinedload fetches each block's requests in the same query
    return (
        db.query(Block)
        .options(joinedload(Block.requests))
        .order_by(Block.section_id, Block.start)
        .all()
    )
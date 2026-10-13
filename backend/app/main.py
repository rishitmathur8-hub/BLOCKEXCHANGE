from typing import List

from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Request, Train
from app.schemas import RequestOut, TrainOut

app = FastAPI(title="Block Exchange")


@app.get("/")
def home():
    return {"status": "Block Exchange running"}


@app.get("/trains", response_model=List[TrainOut])
def get_trains(db: Session = Depends(get_db)):
    return db.query(Train).order_by(Train.entry_time).all()


@app.get("/requests", response_model=List[RequestOut])
def get_requests(db: Session = Depends(get_db)):
    # sirf live requests: jo abhi kisi block mein merge nahi hui
    return db.query(Request).filter(Request.block_id.is_(None)).all()
from typing import List

from pydantic import BaseModel, ConfigDict


class TrainOut(BaseModel):
    id: int
    number: str
    category: str
    entry_time: int
    exit_time: int
    weight: int

    model_config = ConfigDict(from_attributes=True)


class RequestOut(BaseModel):
    id: int
    dept: str
    section_id: int
    km_from: float
    km_to: float
    duration_min: int
    window_start: int
    window_end: int
    work_type: str
    needs_power_block: bool

    model_config = ConfigDict(from_attributes=True)


class BlockOut(BaseModel):
    id: int
    section_id: int
    start: int
    end: int
    status: str
    requests: List[RequestOut]

    model_config = ConfigDict(from_attributes=True)
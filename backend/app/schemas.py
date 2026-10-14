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


class SectionOut(BaseModel):
    id: int
    name: str
    from_station: str
    to_station: str
    length_km: float

    model_config = ConfigDict(from_attributes=True)


class BlockEventOut(BaseModel):
    id: int
    block_id: int
    planned_duration: int
    granted_duration: int
    actual_start: int | None = None
    actual_end: int | None = None
    overrun_reason: str | None = None

    model_config = ConfigDict(from_attributes=True)


class BlockDetailedOut(BaseModel):
    id: int
    section_id: int
    section_name: str | None = None
    start: int
    end: int
    status: str
    request_ids: List[int]
    requests: List[RequestOut]
    event: BlockEventOut | None = None
    overrun_min: int = 0

    model_config = ConfigDict(from_attributes=True)


class AuditEntryIn(BaseModel):
    user_role: str
    user_name: str
    action: str
    entity_type: str
    entity_id: str
    reason: str | None = None
    details: str | None = None


class AuditEntryOut(AuditEntryIn):
    id: int
    timestamp: str

    model_config = ConfigDict(from_attributes=True)


class OverlapCheckIn(BaseModel):
    section_id: int
    km_from: float
    km_to: float
    window_start: int
    window_end: int
    duration_min: int


class OverlapCheckOut(BaseModel):
    has_overlaps: bool
    overlapping_requests: List[RequestOut]
    overlapping_blocks: List[BlockOut]
    merge_candidate: bool
    reason: str
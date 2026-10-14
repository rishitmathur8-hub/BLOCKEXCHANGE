from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# Time sab jagah "din ke shuru se minutes" mein: 10:30 = 630


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    from_station = Column(String)
    to_station = Column(String)
    length_km = Column(Float)

    trains = relationship("Train", back_populates="section")
    requests = relationship("Request", back_populates="section")


class Train(Base):
    __tablename__ = "trains"

    id = Column(Integer, primary_key=True)
    number = Column(String)
    section_id = Column(Integer, ForeignKey("sections.id"))
    category = Column(String)      # Rajdhani / Express / Passenger / Freight
    entry_time = Column(Integer)   # section mein kab ghusi (minutes)
    exit_time = Column(Integer)    # section se kab nikli (minutes)
    weight = Column(Integer)       # priority: Rajdhani=5, Express=3, Passenger=2, Freight=1

    section = relationship("Section", back_populates="trains")


class Block(Base):
    """Merge ke baad ka final block. Ek block mein kai requests ho sakti hain."""
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True)
    section_id = Column(Integer, ForeignKey("sections.id"))
    start = Column(Integer)        # minutes
    end = Column(Integer)          # minutes
    # requested -> proposed -> approved -> started -> completed / overrun / cancelled
    status = Column(String, default="proposed")

    requests = relationship("Request", back_populates="block")
    event = relationship("BlockEvent", back_populates="block", uselist=False)


class Request(Base):
    """Kisi department ki block request."""
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True)
    dept = Column(String)               # Engineering / S&T / OHE
    section_id = Column(Integer, ForeignKey("sections.id"))
    km_from = Column(Float)
    km_to = Column(Float)
    duration_min = Column(Integer)      # kitne minute ka block chahiye
    window_start = Column(Integer)      # sabse jaldi kab shuru ho sakta hai
    window_end = Column(Integer)        # sabse der tak kab khatam ho jana chahiye
    work_type = Column(String)          # track_repair / signal_work / ohe_work ...
    needs_power_block = Column(Boolean, default=False)

    block_id = Column(Integer, ForeignKey("blocks.id"), nullable=True)

    section = relationship("Section", back_populates="requests")
    block = relationship("Block", back_populates="requests")


class BlockEvent(Base):
    """Field supervisor ka start/end data: planned vs granted vs actual."""
    __tablename__ = "block_events"

    id = Column(Integer, primary_key=True)
    block_id = Column(Integer, ForeignKey("blocks.id"))
    planned_duration = Column(Integer)   # department ne maanga
    granted_duration = Column(Integer)   # control ne diya
    actual_start = Column(Integer, nullable=True)
    actual_end = Column(Integer, nullable=True)
    overrun_reason = Column(String, nullable=True)

    block = relationship("Block", back_populates="event")


class AuditEntry(Base):
    """Audit log of human decisions and operational actions."""
    __tablename__ = "audit_entries"

    id = Column(Integer, primary_key=True)
    timestamp = Column(String)  # ISO string or formatted timestamp
    user_role = Column(String)  # Controller, Field Supervisor, Dept Officer
    user_name = Column(String)  # Human decision maker
    action = Column(String)     # APPROVE, REJECT, MODIFY, START, END, REPLAN_ACCEPT, etc.
    entity_type = Column(String)# block, proposal, request, replan
    entity_id = Column(String)  # identifier
    reason = Column(String, nullable=True) # human provided reason
    details = Column(String, nullable=True)# optional metadata summary
# Backend Enhancements & Backward Compatibility Log

To support the React frontend requirements (instant overlap detection, rich Gantt timeline attributes, field supervisor start/end timestamps, predictive re-planning, and decision audit trail) without modifying existing business rules or breaking test suites, the following backward-compatible endpoints and Pydantic schemas were added:

---

## 1. Schema Additions (`backend/app/schemas.py`)
- `SectionOut`: Serializes track section id, name, endpoints (`from_station`, `to_station`), and length in km.
- `BlockEventOut`: Serializes field execution timestamps (`actual_start`, `actual_end`), planned/granted durations, and overrun reason.
- `BlockDetailedOut`: Extends `BlockOut` with full nested `requests` array, linked `BlockEventOut`, and computed `overrun_min`.
- `OverlapCheckIn` & `OverlapCheckOut`: Carries track km range and time window parameters to return potential conflicts before submitting a new request.
- `AuditEntryIn` & `AuditEntryOut`: Captures human decisions (who, what, when, why, details).

---

## 2. Model Additions (`backend/app/models.py`)
- `AuditEntry`: Lightweight SQLite model (`audit_entries` table) capturing:
  - `id`: Integer primary key
  - `timestamp`: ISO-8601 string
  - `user_role`: "Section Controller", "Field Supervisor", "S&T Officer", etc.
  - `user_name`: Human operator name
  - `action`: "APPROVE_BLOCK", "REJECT_MERGE", "MODIFY_BLOCK", "START_WORK", "END_WORK", "CREATE_REQUEST", "REPLAN_ACCEPT", "REPLAN_REJECT", "CANCEL_BLOCK"
  - `entity_type`: "block", "proposal", "request", "replan"
  - `entity_id`: Target entity identifier
  - `reason`: Mandatory/optional confirmation justification
  - `details`: Operational context summary

---

## 3. Endpoint Additions (`backend/app/main.py`)

1. **`GET /sections`**
   - Returns all railway sections with station names and km length.
   - Backward compatible: Does not modify any existing tables or routes.

2. **`POST /requests/check-overlap`**
   - Takes proposed request parameters and immediately performs spatial (`km_overlap`) and temporal window checks against unassigned requests and active blocks on the section.
   - Enables Phase 2 requirement: *"On submit, immediately show any overlapping requests the backend finds."*

3. **`GET /blocks/detailed`**
   - Returns all blocks with populated `requests` lists and linked `BlockEvent` timestamps.
   - Retains existing `GET /blocks` unchanged for backward compatibility with legacy scripts.

4. **`GET /predict/overrun-analysis`**
   - Computes active overrun risk, confidence metrics (HIGH/MEDIUM/LOW based on sample counts), and dynamic re-plan slot suggestions using `cost.slot_options`.

5. **`GET /audit-logs` & `POST /audit-logs`**
   - Retrieves and records human decision logs. Pre-seeds realistic operational history on first run.

---

## 4. Test Verification
- Ran `python test_merge.py` before and after changes: passes with identical output (12 requests -> 8 blocks).
- Verified with FastAPI `TestClient` across all new endpoints with zero errors.

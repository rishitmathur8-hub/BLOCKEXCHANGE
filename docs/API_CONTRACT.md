# Block Exchange: Verified API Contract

This document provides the verified API contract for the Block Exchange backend based on the actual Python codebase (`backend/app/main.py`, `backend/app/schemas.py`, `backend/app/models.py`, `backend/app/merge.py`, `backend/app/cost.py`, `backend/app/scheduler.py`, `backend/app/predict.py`).

---

## 1. Connection & Protocol

- **Base URL (Local)**: `http://127.0.0.1:8000`
- **Framework**: FastAPI with Uvicorn
- **CORS Configuration**: `CORSMiddleware` active with `allow_origins=["*"]`, `allow_methods=["*"]`, `allow_headers=["*"]`.
- **Database**: SQLite (`sqlite:///./blockexchange.db`).
- **Time Rule**: All time values are integers representing **minutes since start of day (midnight 00:00)**.
  - Range: `0` (00:00) to `1439` (23:59). Values $\ge 1440$ represent next day (+1d).
  - Example: `10:30` is $10 \times 60 + 30 = 630$.
- **Advisory Principle**: "Advisory only: final decision rests with the authorised officer." The system provides suggestions; every approval, rejection, or execution step requires explicit human action.
- **Status Lifecycle**:
  `requested` (unassigned request) $\rightarrow$ `proposed` (merged block proposal) $\rightarrow$ `approved` (officer confirmed) $\rightarrow$ `started` (field work initiated) $\rightarrow$ `completed` or `overrun` (work ended) | `cancelled` (withdrawn prior to start).

---

## 2. Endpoints Inventory

### 2.1 Health Check
- **Method & Path**: `GET /`
- **Request**: None
- **Response** (`200 OK`):
  ```json
  {
    "status": "Block Exchange running"
  }
  ```

---

### 2.2 Trains
- **Method & Path**: `GET /trains`
- **Query Parameters**:
  - `section_id` (optional, integer): Filter trains passing through the specified section.
- **Response** (`200 OK`): Array of train objects ordered by `entry_time`:
  ```json
  [
    {
      "id": 1,
      "number": "12017",
      "section_id": 1,
      "category": "Rajdhani",
      "entry_time": 380,
      "exit_time": 450,
      "weight": 5
    }
  ]
  ```
- **Categories & Weights**:
  - `Rajdhani` (weight 5)
  - `Express` (weight 3)
  - `Passenger` (weight 2)
  - `Freight` (weight 1)

---

### 2.3 Unassigned Block Requests
- **Method & Path**: `GET /requests`
- **Description**: Returns all maintenance requests submitted by departments that have not yet been assigned to a block (`block_id is null`).
- **Response** (`200 OK`): Array of request objects:
  ```json
  [
    {
      "id": 1,
      "dept": "Engineering",
      "section_id": 1,
      "km_from": 22.0,
      "km_to": 28.0,
      "duration_min": 120,
      "window_start": 600,
      "window_end": 960,
      "work_type": "track_repair",
      "needs_power_block": false,
      "block_id": null
    }
  ]
  ```

---

### 2.4 Blocks
- **Method & Path**: `GET /blocks`
- **Description**: Returns all blocks in the database ordered by `section_id`, then `start`.
- **Response** (`200 OK`): Array of block objects:
  ```json
  [
    {
      "id": 1,
      "section_id": 1,
      "start": 600,
      "end": 720,
      "status": "proposed",
      "request_ids": [1, 2, 3]
    }
  ]
  ```

---

### 2.5 Merge Proposals
- **Method & Path**: `GET /merge-proposals`
- **Description**: Evaluates unassigned requests, merges overlapping requests into proposed blocks in the database, and returns all currently `proposed` blocks with full request details.
- **Response** (`200 OK`):
  ```json
  [
    {
      "block_id": 51,
      "section_id": 1,
      "start": 600,
      "end": 720,
      "depts": ["Engineering", "OHE", "S&T"],
      "needs_power_block": true,
      "requests": [
        {
          "id": 1,
          "dept": "Engineering",
          "km_from": 22.0,
          "km_to": 28.0,
          "duration_min": 120,
          "window_start": 600,
          "window_end": 960,
          "work_type": "track_repair",
          "needs_power_block": false
        }
      ]
    }
  ]
  ```
- **Errors**: `501 Not Implemented` if `merge.find_merge_proposals` is missing.

---

### 2.6 Block Slot Options (Delay Cost Analysis)
- **Method & Path**: `GET /blocks/{block_id}/options`
- **Path Parameters**: `block_id` (integer)
- **Description**: Generates a 15-minute stepping table across the allowed maintenance window, calculating the train-delay impact and weighted cost for each candidate start time.
- **Response** (`200 OK`):
  ```json
  [
    {
      "start": 600,
      "end": 720,
      "start_hhmm": "10:00",
      "end_hhmm": "12:00",
      "cost": 150.0,
      "delay_minutes": 50.0,
      "trains_hit": 2,
      "affected": [
        {
          "train": "14012",
          "category": "Express",
          "delay_min": 35
        }
      ],
      "recommended": false
    },
    {
      "start": 780,
      "end": 900,
      "start_hhmm": "13:00",
      "end_hhmm": "15:00",
      "cost": 30.0,
      "delay_minutes": 10.0,
      "trains_hit": 1,
      "affected": [
        {
          "train": "FR102",
          "category": "Freight",
          "delay_min": 10
        }
      ],
      "recommended": true
    }
  ]
  ```
- **Errors**:
  - `404 Not Found`: `{"detail": "Block not found"}`
  - `501 Not Implemented`: `{"detail": "cost.slot_options is not implemented yet"}`

---

### 2.7 Overrun Buffers (Predictive Model)
- **Method & Path**: `GET /predict/buffers`
- **Description**: Analyzes historical completed/overrun `BlockEvent`s and returns average overrun minutes by `work_type`.
- **Response** (`200 OK`):
  ```json
  {
    "track_repair": 25,
    "rail_welding": 30,
    "ballast_work": 35,
    "signal_work": 12,
    "point_maintenance": 10,
    "ohe_work": 18
  }
  ```

---

### 2.8 Submit New Block Request
- **Method & Path**: `POST /requests`
- **Request Body** (`application/json`):
  ```json
  {
    "dept": "Engineering",
    "section_id": 1,
    "km_from": 22.0,
    "km_to": 28.0,
    "duration_min": 120,
    "window_start": 600,
    "window_end": 960,
    "work_type": "track_repair",
    "needs_power_block": false
  }
  ```
- **Validation**:
  - `km_from <= km_to` (otherwise `400 Bad Request: km_from must be <= km_to`)
  - `window_end - window_start >= duration_min` (otherwise `400 Bad Request: Time window is shorter than the duration`)
- **Response** (`200 OK`): Created request object with `id` and `block_id: null`.

---

### 2.9 Joint Optimization (CP-SAT Scheduler)
- **Method & Path**: `POST /optimize` and `POST /optimize/save`
- **Description**: Runs Google OR-Tools CP-SAT joint solver considering historical safety buffers, track kilometres, and train schedules. Feasible conflict-free proposals are persisted as `proposed` blocks.
- **Response** (`200 OK`):
  ```json
  {
    "proposals": [
      {
        "proposal_id": "S1-R1-2-3",
        "section_id": 1,
        "section_name": "Saharanpur-Ambala",
        "request_ids": [1, 2, 3],
        "requests": [...],
        "depts": ["Engineering", "OHE", "S&T"],
        "km_from": 20.0,
        "km_to": 30.0,
        "needs_power_block": true,
        "start": 780,
        "end": 900,
        "start_hhmm": "13:00",
        "end_hhmm": "15:00",
        "safe_end": 925,
        "safe_end_hhmm": "15:25",
        "merged_cost": 45.0,
        "separate_cost": 120.0,
        "cost_saved": 75.0,
        "recommend_merge": true,
        "train_delay_min": 15.0,
        "affected_trains": [...],
        "worst_case_cost": 85.0,
        "worst_case_delay_min": 35.0,
        "risk": "MEDIUM",
        "expected_overrun_min": 25,
        "suggested_buffer_min": 25,
        "predicted_end": 925,
        "status": "pending_human_approval",
        "feasible": true,
        "conflicts_with": [],
        "warnings": []
      }
    ],
    "unschedulable": [],
    "warnings": [],
    "summary": {
      "proposals": 5,
      "unschedulable_requests": 0,
      "merged_cost": 180.0,
      "separate_cost": 390.0,
      "cost_saved": 210.0,
      "high_risk": 1,
      "with_conflicts": 0,
      "infeasible": 0,
      "merging_increases_cost": 0
    },
    "saved": [
      { "proposal_id": "S1-R1-2-3", "block_id": 59 }
    ],
    "skipped": []
  }
  ```

---

### 2.10 Approve Block
- **Method & Path**: `POST /blocks/{block_id}/approve`
- **Request Body**:
  ```json
  {
    "approved_by": "Section Controller"
  }
  ```
- **Validation**: Block status must be `"proposed"`. Otherwise `400 Bad Request: Only a 'proposed' block can be approved`.
- **Response** (`200 OK`): Block object with `status: "approved"`. Automatically creates `BlockEvent` with `planned_duration` and `granted_duration`.

---

### 2.11 Start Block (Field Check-In)
- **Method & Path**: `POST /blocks/{block_id}/start`
- **Request Body**:
  ```json
  {
    "at_minute": 615
  }
  ```
  *(If `at_minute` is null or omitted, defaults to current clock minute).*
- **Validation**: Block status must be `"approved"`. Otherwise `400 Bad Request: Block must be 'approved' before it can start`.
- **Response** (`200 OK`): Block object with `status: "started"`.

---

### 2.12 End Block (Field Check-Out)
- **Method & Path**: `POST /blocks/{block_id}/end`
- **Request Body**:
  ```json
  {
    "at_minute": 745,
    "overrun_reason": "crew shortage"
  }
  ```
- **Validation**: Block status must be `"started"`. Otherwise `400 Bad Request: Block must be 'started' before it can end`.
- **Response** (`200 OK`):
  ```json
  {
    "id": 1,
    "section_id": 1,
    "start": 600,
    "end": 720,
    "status": "overrun",
    "request_ids": [1, 2, 3],
    "overrun_min": 15
  }
  ```
  *(If overrun == 0, status is `"completed"` and `"overrun_min": 0`).*

---

### 2.13 Cancel Block
- **Method & Path**: `POST /blocks/{block_id}/cancel`
- **Request Body**: None
- **Validation**: Status must be `"proposed"` or `"approved"`.
- **Side Effects**: Releases linked requests back to unassigned (`request.block_id = None`), cleans up any unstarted `BlockEvent`, sets `status = "cancelled"`.
- **Response** (`200 OK`): Block object with `status: "cancelled"`.

---

## 3. Discrepancies: `docs/api.md` vs Real Code

1. **`GET /blocks` Schema**:
   - `docs/api.md` stated it returned `request_ids` as an array of IDs.
   - `schemas.py` defines `BlockOut` with full nested `requests: List[RequestOut]`, but `main.py`'s `block_dict()` serializes `"request_ids": [r.id for r in b.requests]`. The code output governs.
2. **`GET /merge-proposals` Schema & Behavior**:
   - `docs/api.md` stated `needs_human_review: true` and showed dummy fields without `block_id`.
   - Real code: Calls `run_merge(db)` which actually saves proposed blocks to the database and returns `block_id`, `section_id`, `start`, `end`, `depts`, `needs_power_block`, and nested `requests`.
3. **`GET /blocks/{id}/options` Response**:
   - `docs/api.md` showed only `start`, `delay_minutes`, `trains_hit`.
   - Real code provides `start`, `end`, `start_hhmm`, `end_hhmm`, `cost`, `delay_minutes`, `trains_hit`, `affected: [{train, category, delay_min}]`, and `recommended: boolean`.
4. **`POST /optimize` Output**:
   - `docs/api.md` showed a truncated mockup `{"total_delay_minutes": 140, "blocks": [...]}`.
   - Real code returns full CP-SAT solver results with `proposals`, `unschedulable`, `warnings`, `summary`, `saved`, and `skipped`.
5. **`POST /blocks/{id}/cancel`**:
   - Implemented in `main.py`, but omitted entirely from `docs/api.md`.
6. **`GET /` Health Check**:
   - Implemented in `main.py`, omitted from `docs/api.md`.

---

## 4. Backend Module to Feature Mapping & Unexposed Capabilities

| Module | Core Logic | Currently Exposed Endpoints | Unexposed / Gaps Needing Backward-Compatible Endpoints |
|---|---|---|---|
| `merge.py` | Overlap detection, grouping, proposed block generation | `GET /merge-proposals` | Instant overlap check for new request submission without modifying DB |
| `cost.py` | Train passage calculation, delay minute computation, slot stepping | `GET /blocks/{block_id}/options` | Dynamic cost comparison between separate vs merged requests |
| `predict.py` | Historical buffer calculation from completed `BlockEvents` | `GET /predict/buffers` | Real-time overrun prediction & re-plan calculation for active/started blocks |
| `cpsat_scheduler.py` | Joint CP-SAT constraint satisfaction | Indirectly via `POST /optimize` | Dry-run / re-plan endpoint that suggests changes when an overrun occurs |
| `scheduler.py` | Schedule generation, conflict checking, risk scoring | `POST /optimize`, `POST /optimize/save` | Querying full block details including event timings (actual start/end) |
| *Database* | `Section`, `Train`, `Block`, `Request`, `BlockEvent` | `GET /trains`, `GET /requests`, `GET /blocks` | `GET /sections` (to get station names and lengths); `GET /events` or rich block events; Audit logging |

# Block Exchange: Indian Railways Corridor Maintenance Advisory System

> **Advisory only: final decision rests with the authorised officer.**

Block Exchange is a unified operations advisory window where the **Engineering**, **Signalling & Telecom (S&T)**, and **Electrical (OHE)** departments of Indian Railways request track closures (maintenance blocks). Instead of fragmented letters and phone calls, the system:
1. Accepts block requests from all departments in one single window.
2. Finds overlapping corridor requests and proposes merging them into shared closures, minimizing passenger train delays and maximizing productive maintenance time.
3. Computes the train-delay cost of every candidate start time using a conservative corridor clearing model.
4. Lets field supervisors mark when work started and ended, with offline-resilient queuing.
5. Uses completion history to predict overruns and suggest dynamic re-plans.

---

## 1. Architecture & Module Mapping

```
+---------------------------------------------------------------------------------+
|                                React Frontend (Vite)                            |
|  - Dashboard: Metrics & Savings Chart (/src/pages/DashboardPage.tsx)           |
|  - New Requisition Form (/src/components/request/NewRequestForm.tsx)            |
|  - 24-hr Gantt Timeline (/src/components/timeline/BlockTimeline.tsx)           |
|  - Merge Suggestions (/src/components/merge/MergeSuggestions.tsx)               |
|  - Delay Cost Stepping (/src/components/cost/DelayCostPanel.tsx)               |
|  - Field Staff View (/src/components/field/FieldStaffView.tsx)                 |
|  - Overrun Predictions (/src/components/predict/OverrunPredictView.tsx)         |
|  - Audit Log Viewer (/src/components/audit/AuditLogView.tsx)                   |
+---------------------------------------+-----------------------------------------+
                                        | HTTP / JSON (API Base: :8000)
+---------------------------------------v-----------------------------------------+
|                               FastAPI Backend (:8000)                           |
|  - app/main.py: REST Endpoints & Route Controllers                              |
|  - app/merge.py: Overlap Detection & Joint Block Proposals                      |
|  - app/cost.py: Train-Delay Cost & 15m Stepping Candidates                      |
|  - app/predict.py: Historical Overrun Buffers per Asset Type                    |
|  - app/scheduler.py & cpsat_scheduler.py: Google OR-Tools CP-SAT Joint Solver  |
|  - app/database.py & models.py: SQLite Database (blockexchange.db)              |
+---------------------------------------------------------------------------------+
```

---

## 2. Quickstart: One-Command Setup & Run

### Windows
Double-click `run.bat` or execute in PowerShell:
```powershell
.\run.bat
```

### Linux / macOS
```bash
chmod +x run.sh
./run.sh
```

### Manual Individual Execution
#### 1. Backend:
```bash
cd backend
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload --port 8000
```
*Backend is accessible at `http://127.0.0.1:8000` (Swagger docs at `/docs`).*

#### 2. Frontend:
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
*Frontend is accessible at `http://localhost:5173`.*

---

## 3. Repository Directory Structure

```
BLOCKEXCHANGE/
├── backend/
│   ├── app/
│   │   ├── cost.py              # Train-delay calculation & slot stepping
│   │   ├── cpsat_scheduler.py   # Google OR-Tools CP-SAT constraint satisfaction
│   │   ├── database.py          # SQLAlchemy SQLite connection
│   │   ├── main.py              # FastAPI endpoints & CORS
│   │   ├── merge.py             # Spatial and temporal overlap grouping
│   │   ├── models.py            # SQLite schema (Section, Train, Block, Request, Event, Audit)
│   │   ├── predict.py           # Historical average overrun buffers
│   │   ├── scheduler.py         # Schedule generation & conflict analysis
│   │   └── schemas.py           # Pydantic input/output contracts
│   ├── requirements.txt         # FastAPI, uvicorn, ortools, sqlalchemy
│   ├── seed.py                  # Realistic 40 trains, 12 live requests, 50 history blocks
│   └── test_merge.py            # Backend test suite
├── docs/
│   ├── API_CONTRACT.md          # Complete verified contract of all backend endpoints
│   ├── BACKEND_CHANGES.md       # Backward-compatible additions log
│   └── DECISIONS.md             # Technical and architectural decisions
├── frontend/                    # Modern React 18 + Tailwind CSS + TypeScript App
│   ├── src/
│   │   ├── api/client.ts        # Typed API client with offline sync
│   │   ├── components/
│   │   │   ├── common/          # Banner, Header, Sidebar, ConfirmDialog, States
│   │   │   ├── dashboard/       # MetricsGrid, MergeSavingsChart, TrainsTable, BlocksTable
│   │   │   ├── request/         # NewRequestForm with instant overlap check
│   │   │   ├── timeline/        # 24-hr IST Gantt timeline by section
│   │   │   ├── merge/           # MergeSuggestions side-by-side comparison
│   │   │   ├── cost/            # DelayCostPanel 15-min stepping table & curve
│   │   │   ├── field/           # Mobile-first FieldStaffView with offline queue
│   │   │   ├── predict/         # OverrunPredictView & dynamic re-plans
│   │   │   └── audit/           # AuditLogView & CSV export
│   │   ├── context/             # RoleContext (Controller, Field Staff, Dept Officers)
│   │   ├── pages/               # React Router page views
│   │   ├── test/                # 15 unit and E2E happy path tests
│   │   ├── types/               # Full TypeScript definitions matching backend
│   │   └── utils/               # 24-hr IST time formatters & offlineQueue
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── frontend-legacy/             # Preserved legacy vanilla HTML/CSS/JS frontend
├── run.bat                      # Windows 1-click run script
└── run.sh                       # Unix/macOS 1-click run script
```

---

## 4. Migration Checklist: Legacy Feature Parity

| Legacy Feature (`frontend-legacy/`) | Modern React Component (`frontend/src/`) | Parity & Enhancements |
|---|---|---|
| **Live Statistics Cards** (`#stat-blocks`, `#stat-requests`, `#stat-completed`, `#stat-overruns`) | `src/components/dashboard/MetricsGrid.tsx` | **100% + Enhanced**: Added Train Delay Minutes Saved by Merging & Active Possession counts. |
| **Day Timeline** (`#timeline`, `#lane`, `#axis`, `.win`, `.bar`, `.now`) | `src/components/timeline/BlockTimeline.tsx` | **100% + Enhanced**: 24-hr IST grid, section lanes, live time indicator, department filter, and slide-over inspection drawer. |
| **Blocks Table** (`#blocks-body`, `#blocks-count`) | `src/components/dashboard/RecentBlocksTable.tsx` | **100% + Enhanced**: Added status chips, options inspection link, and one-click Controller Approve/Cancel dialogs. |
| **Open Requests Table** (`#requests-body`, `#requests-count`) | `src/components/dashboard/OpenRequestsTable.tsx` | **100% + Enhanced**: Department badges (ENG, S&T, OHE), km range, permissible window in IST, and OHE isolation badges. |
| **Trains Movement Table** (`#trains-body`, `#trains-count`) | `src/components/dashboard/TrainsTable.tsx` | **100% + Enhanced**: Category filter (Rajdhani, Express, Passenger, Freight), IST entry/exit times, and delay multipliers. |
| **New Request Modal & Form** (`#req-modal`, `#req-form`) | `src/components/request/NewRequestForm.tsx` | **100% + Enhanced**: React Hook Form + Zod, 24-hr IST pickers, and **real-time backend overlap detection**. |
| **API Client** (`api.js`) | `src/api/client.ts` | **100% + Enhanced**: Typed TypeScript client, error normalization, and offline queue synchronization. |
| **Styles & Aesthetics** (`style.css`) | `tailwind.config.js` & `src/index.css` | **100% + Enhanced**: Curated Indian Railways navy palette (`#070D18`), status colors, and Barlow / Barlow Condensed typography. |
| *(New Phase 2 Requirement)* | `src/components/merge/MergeSuggestions.tsx` | **Added**: Side-by-side "Separate vs Merged" impact comparison with confirmable decisions. |
| *(New Phase 2 Requirement)* | `src/components/cost/DelayCostPanel.tsx` | **Added**: 15-minute slot stepping table, Recharts cost curve, and impacted trains list. |
| *(New Phase 3 Requirement)* | `src/components/field/FieldStaffView.tsx` | **Added**: Mobile-first tactile Work Started / Ended possession recording with offline queue. |
| *(New Phase 3 Requirement)* | `src/components/predict/OverrunPredictView.tsx` | **Added**: Planned vs actual buffers, confidence metrics, and dynamic re-plan suggestions. |
| *(New Phase 3 Requirement)* | `src/components/audit/AuditLogView.tsx` | **Added**: Immutable decision trail with search, filters, and CSV export. |
| *(New Phase 1 Requirement)* | `src/components/common/AdvisoryBanner.tsx` | **Added**: Persistent warning: *"Advisory only: final decision rests with the authorised officer."* |
| *(New Phase 1 Requirement)* | `src/context/RoleContext.tsx` | **Added**: Role switcher supporting Section Controller, Field Supervisor, and Dept Officers. |

---

## 5. Verification & Test Suite

### Running Backend Tests
```bash
cd backend
python test_merge.py
```
*Output: 12 requests -> 8 blocks (100% passing without regressions).*

### Running Frontend Tests
```bash
cd frontend
npm test
```
*Output: 15 passing tests across 5 test suites (API Client, Key Operational Flows, Offline Queue, IST Time Utils, End-to-End Happy Path).*

### Running Production Bundle Build
```bash
cd frontend
npm run build
```
*Output: Clean TypeScript check and production bundle in `dist/` with 0 errors.*
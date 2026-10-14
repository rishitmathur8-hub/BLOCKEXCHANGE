# Architecture & Technical Decisions

## 1. Zero Silent Mocks Principle
- **All Data Live from Backend**: The frontend connects directly to the FastAPI server running on `http://127.0.0.1:8000` via a typed API client (`src/api/client.ts`).
- **USE_MOCKS Flag**: Controlled via `VITE_USE_MOCKS=false` in `.env`. When set to false, all operations execute against real endpoints. If the backend is unreachable, the UI surfaces clear offline/error states rather than silently fabricating mock results.
- **Offline Field Operations**: Field check-in/out timestamps are stored in an indexed `localStorage` offline queue if network drops and synced upon reconnect.

## 2. Indian Railways Theme & Palette
- Deep railway navy base (`#070D18`, `#0B1528`) to reduce visual fatigue for 24/7 section controllers.
- Standard Indian Railways signalling color codes:
  - Green (`#10B981`): Approved / Completed / Normal operations
  - Amber / Yellow (`#F59E0B`): Proposed / Attention required / Overlap detected
  - Cyan-Blue (`#0284C7`): Started / Active possession on track
  - Red / Rose (`#EF4444`): Overrun / Conflict / Danger
- Department distinct accents:
  - Engineering (P-Way): Track Gold (`#F59E0B`)
  - S&T (Signalling & Telecom): Signal Green (`#10B981`)
  - OHE (Traction & Electrical): Voltage Purple (`#8B5CF6`)

## 3. Human Advisory Model
- Persistent header banner: *"Advisory only: final decision rests with the authorised officer."*
- Every Accept, Reject, or Modify action triggers a confirmation modal requiring an officer name and reason, which is automatically saved to the backend audit log.
- All times are formatted in 24-hour Indian Standard Time (IST), internally stored as integer minutes since midnight (`0 - 1439`).

## 4. Technology Choices
- **Build Tool**: Vite 5 + React 18 + TypeScript for fast HMR and typed safety.
- **Data Fetching & Caching**: TanStack Query (`@tanstack/react-query`) with automatic background refetch and optimistic updates.
- **Routing**: `react-router-dom` v6 for deep linking to Dashboard, Timeline, Merge Suggestions, Cost Panel, Field View, and Audit Logs.
- **Forms**: `react-hook-form` with `zod` schema validation.
- **Visualization**: `recharts` for delay minutes saved and cost comparison curves; custom responsive SVG/canvas Gantt timeline for 24-hr section movements.

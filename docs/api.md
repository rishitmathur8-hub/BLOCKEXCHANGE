# Block Exchange: API Contract

Base URL (local): http://127.0.0.1:8000

Time rule: all times are integers = minutes since midnight. 10:30 = 630.
Status flow: requested -> proposed -> approved -> started -> completed / overrun / cancelled
Advisory only: the system proposes. Only a human calls /approve.

## Read endpoints (GET = give me data)

### GET /trains?section_id=1
[{"id": 1, "number": "12017", "section_id": 1, "category": "Rajdhani",
  "entry_time": 380, "exit_time": 450, "weight": 5}]

### GET /requests
[{"id": 1, "dept": "Engineering", "section_id": 1, "km_from": 10.0, "km_to": 14.0,
  "duration_min": 120, "window_start": 600, "window_end": 900,
  "work_type": "track_repair", "needs_power_block": false, "block_id": null}]

### GET /blocks
[{"id": 7, "section_id": 1, "start": 780, "end": 870, "status": "proposed",
  "request_ids": [1, 2, 3]}]

### GET /merge-proposals
[{"request_ids": [1, 2, 3], "section_id": 1, "km_from": 10.0, "km_to": 14.0,
  "duration_min": 120, "needs_human_review": true}]

### GET /blocks/{id}/options
[{"start": 600, "delay_minutes": 85, "trains_hit": 4},
 {"start": 795, "delay_minutes": 20, "trains_hit": 1}]

### GET /predict/buffers
{"track_repair": 18, "signal_work": 9, "ohe_work": 25}

## Write endpoints (POST = I am sending you data)

### POST /requests
Send: {"dept": "S&T", "section_id": 1, "km_from": 11.0, "km_to": 13.0,
       "duration_min": 90, "window_start": 600, "window_end": 900,
       "work_type": "signal_work", "needs_power_block": false}
Returns: the created request (with an id)

### POST /optimize
Returns: {"total_delay_minutes": 140,
          "blocks": [{"block_id": 7, "start": 780, "end": 870}]}

### POST /blocks/{id}/approve
Send: {"approved_by": "Section Controller"}
Returns: the block with status "approved"

### POST /blocks/{id}/start
Send: {}
Returns: the block with status "started"

### POST /blocks/{id}/end
Send: {"overrun_reason": "material late"}
Returns: the block with status "completed" or "overrun", plus "overrun_min"

## Errors
{"detail": "Block must be 'approved' before it can start"}   (HTTP 400)
{"detail": "Block not found"}                                 (HTTP 404)


# backend/app/cpsat_scheduler.py

from ortools.sat.python import cp_model
from app.cost import group_cost

STEP = 15


def optimize_groups(
    trains_by_section,
    sections_by_id,
    groups,
    buffers_by_group=None,
    time_limit=10,
):
    """
    Jointly schedule maintenance groups.

    Priorities:
    1. Schedule as many groups as possible.
    2. Minimize total train-delay cost.
    3. Respect safety buffers and prevent overlapping blocks
       on the same section and overlapping track kilometres.

    Returns:
        A list of selected proposals, or None if the solver fails.
        Each selected proposal includes its original group_index.
    """
    buffers_by_group = buffers_by_group or {}
    model = cp_model.CpModel()
    candidates = []
    candidates_by_group = {i: [] for i in range(len(groups))}

    # Generate feasible time-slot candidates for each group.
    for group_index, group in enumerate(groups):
        section_id = group["section_id"]
        section = sections_by_id.get(section_id)

        if section is None or section.length_km is None:
            continue

        if section.length_km <= 0:
            continue

        duration = group["duration_min"]
        buffer_min = max(0, buffers_by_group.get(group_index, 0))
        trains = trains_by_section.get(section_id, [])

        start = group["window_start"]

        while start + duration + buffer_min <= group["window_end"]:
            scheduled_group = {
                **group,
                "window_start": start,
                "window_end": start + duration,
            }

            result = group_cost(
                trains,
                section.length_km,
                scheduled_group,
            )

            if result is not None:
                candidate_index = len(candidates)

                candidate = {
                    "group_index": group_index,
                    "section_id": section_id,
                    "start": start,
                    "end": start + duration,
                    "safe_end": start + duration + buffer_min,
                    "scaled_cost": max(
                        0, int(round(result["cost"] * 10))
                    ),
                    "result": result,
                    "group": group,
                }

                candidates.append(candidate)
                candidates_by_group[group_index].append(candidate_index)

            start += STEP

    # No candidates means no groups can be scheduled.
    if not candidates:
        return []

    choices = [
        model.NewBoolVar(f"candidate_{i}")
        for i in range(len(candidates))
    ]

    # Each group is either scheduled exactly once or left unscheduled.
    unscheduled = {}

    for group_index in range(len(groups)):
        unscheduled[group_index] = model.NewBoolVar(
            f"unscheduled_{group_index}"
        )

        group_choices = [
            choices[i]
            for i in candidates_by_group[group_index]
        ]

        model.Add(
            sum(group_choices) + unscheduled[group_index] == 1
        )

    # Prevent overlapping buffered blocks on the same section and track.
    for i, first in enumerate(candidates):
        for j in range(i + 1, len(candidates)):
            second = candidates[j]

            if first["group_index"] == second["group_index"]:
                continue

            if first["section_id"] != second["section_id"]:
                continue

            g1 = first["group"]
            g2 = second["group"]

            km_overlap = (
                g1["km_from"] < g2["km_to"]
                and g2["km_from"] < g1["km_to"]
            )

            time_overlap = (
                first["start"] < second["safe_end"]
                and second["start"] < first["safe_end"]
            )

            if km_overlap and time_overlap:
                model.Add(choices[i] + choices[j] <= 1)

    # Make scheduling another group more important than any cost reduction.
    max_total_cost = sum(
        max(
            candidates[i]["scaled_cost"]
            for i in candidates_by_group[group_index]
        )
        for group_index in range(len(groups))
        if candidates_by_group[group_index]
    )

    unscheduled_penalty = max_total_cost + 1

    model.Minimize(
        sum(
            candidate["scaled_cost"] * choices[i]
            for i, candidate in enumerate(candidates)
        )
        + unscheduled_penalty * sum(unscheduled.values())
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit

    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    selected = []

    for i, candidate in enumerate(candidates):
        if solver.Value(choices[i]):
            selected.append({
                **candidate["result"],
                "group_index": candidate["group_index"],
                "group": candidate["group"],
                "start": candidate["start"],
                "end": candidate["end"],
                "safe_end": candidate["safe_end"],
            })

    return selected

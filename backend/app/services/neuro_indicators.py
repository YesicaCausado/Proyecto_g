"""Neurodigital indicators derived only from events with sufficient evidence."""


def summarize_cognitive_events(events) -> dict:
    empty = {
        "fatigue": None,
        "overload": None,
        "doubt": None,
        "mastery": None,
        "evidence_count": 0,
    }
    counts = {"fatigue": 0, "overload": 0, "doubt": 0, "mastery": 0, "flow": 0, "normal": 0}
    for event in events or []:
        payload = event.event_data
        if not isinstance(payload, dict) or payload.get("sufficient_evidence") is not True:
            continue
        state = payload.get("cognitive_state") or event.inferred_state or "normal"
        if not isinstance(state, str):
            continue
        state = state.strip().lower()
        if state in {"focused", "flow"}:
            state = "flow"
        elif state in {"confused", "confusion"}:
            state = "doubt"
        elif state in {"struggling", "overload"}:
            state = "overload"
        elif state in {"stressed", "fatigue"}:
            state = "fatigue"
        elif state in {"happy", "mastery"}:
            state = "mastery"
        elif state in {"neutral", "normal"}:
            state = "normal"
        if state in counts:
            counts[state] += 1

    total = sum(counts.values())
    if not total:
        return empty
    return {
        "fatigue": int(counts["fatigue"] / total * 100),
        "overload": int(counts["overload"] / total * 100),
        "doubt": int(counts["doubt"] / total * 100),
        "mastery": int((counts["mastery"] + counts["flow"]) / total * 100),
        "evidence_count": total,
    }

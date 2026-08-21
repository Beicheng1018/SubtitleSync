from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SubtitleCue:
    index: int
    start_ms: int
    end_ms: int
    text: str
    normalized_text: str


def format_visible_cues(cues: list[SubtitleCue]) -> str:
    seen: set[int] = set()
    unique: list[SubtitleCue] = []
    for cue in sorted(cues, key=lambda item: (item.start_ms, item.index)):
        if cue.index in seen:
            continue
        seen.add(cue.index)
        unique.append(cue)
    return "\n".join(cue.text for cue in unique)

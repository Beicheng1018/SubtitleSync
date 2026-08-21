from __future__ import annotations

from dataclasses import dataclass

from .models import SubtitleCue


@dataclass(frozen=True)
class TimelineAdvance:
    cue: SubtitleCue | None
    cues: list[SubtitleCue]
    position: int
    playback_ms: int
    changed: bool


class SubtitleTimeline:
    def __init__(self, cues: list[SubtitleCue], max_visible_cues: int = 2) -> None:
        self.cues = cues
        self.max_visible_cues = max(1, max_visible_cues)
        self.current_pos = 0
        self.visible_positions: tuple[int, ...] = ()
        self.playback_ms = 0

    @property
    def current_cue(self) -> SubtitleCue | None:
        if not self.cues:
            return None
        return self.cues[min(max(self.current_pos, 0), len(self.cues) - 1)]

    def anchor_to_cue(self, position: int) -> SubtitleCue | None:
        if not self.cues:
            self.current_pos = 0
            self.playback_ms = 0
            self.visible_positions = ()
            return None
        self.current_pos = min(max(position, 0), len(self.cues) - 1)
        cue = self.cues[self.current_pos]
        self.playback_ms = cue.start_ms
        self.visible_positions = tuple(cue.index for cue in self.visible_cues_at_time(self.playback_ms))
        return cue

    def move_previous(self) -> SubtitleCue | None:
        return self.anchor_to_cue(self.current_pos - 1)

    def move_next(self) -> SubtitleCue | None:
        return self.anchor_to_cue(self.current_pos + 1)

    def cue_position_at_time(self, playback_ms: int) -> int:
        if not self.cues:
            return 0

        position = self.current_pos
        while position + 1 < len(self.cues) and playback_ms >= self.cues[position + 1].start_ms:
            position += 1
        while position > 0 and playback_ms < self.cues[position].start_ms:
            position -= 1
        return position

    def visible_cues_at_time(self, playback_ms: int) -> list[SubtitleCue]:
        if not self.cues:
            return []

        visible_positions = [
            pos
            for pos, cue in enumerate(self.cues)
            if cue.start_ms <= playback_ms <= cue.end_ms
        ]
        if not visible_positions:
            visible_positions = [self.cue_position_at_time(playback_ms)]

        visible_positions = sorted(set(visible_positions))[-self.max_visible_cues :]
        return [self.cues[pos] for pos in visible_positions]

    def advance_to(self, playback_ms: int) -> TimelineAdvance:
        if not self.cues:
            return TimelineAdvance(cue=None, cues=[], position=0, playback_ms=0, changed=False)

        self.playback_ms = max(0, playback_ms)
        new_pos = self.cue_position_at_time(self.playback_ms)
        visible_cues = self.visible_cues_at_time(self.playback_ms)
        visible_positions = tuple(cue.index for cue in visible_cues)
        changed = new_pos != self.current_pos or visible_positions != self.visible_positions
        self.current_pos = new_pos
        self.visible_positions = visible_positions
        return TimelineAdvance(
            cue=self.current_cue,
            cues=visible_cues,
            position=self.current_pos,
            playback_ms=self.playback_ms,
            changed=changed,
        )

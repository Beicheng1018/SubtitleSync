from __future__ import annotations

from subtitle_sync.srt_parser import parse_srt_text
from subtitle_sync.timeline import SubtitleTimeline


def _cues():
    return parse_srt_text(
        """
1
00:00:01,000 --> 00:00:03,000
first

2
00:00:05,000 --> 00:00:06,000
second

3
00:00:08,000 --> 00:00:09,000
third
"""
    )


def test_timeline_starts_idle_without_cues() -> None:
    timeline = SubtitleTimeline([])

    result = timeline.advance_to(10_000)

    assert not result.changed
    assert result.cue is None
    assert result.cues == []


def test_anchor_to_cue_sets_playback_position() -> None:
    timeline = SubtitleTimeline(_cues())

    cue = timeline.anchor_to_cue(1)

    assert cue is not None
    assert cue.index == 2
    assert timeline.current_pos == 1
    assert timeline.playback_ms == 5_000


def test_timeline_advances_by_subtitle_time() -> None:
    timeline = SubtitleTimeline(_cues())
    timeline.anchor_to_cue(0)

    result = timeline.advance_to(5_100)

    assert result.changed
    assert result.cue is not None
    assert result.cue.index == 2
    assert [cue.index for cue in result.cues] == [2]


def test_timeline_keeps_nearest_cue_during_gap() -> None:
    timeline = SubtitleTimeline(_cues())
    timeline.anchor_to_cue(0)

    result = timeline.advance_to(3_500)

    assert result.cue is not None
    assert result.cue.index == 1
    assert [cue.index for cue in result.cues] == [1]


def test_manual_move_reanchors_timeline() -> None:
    timeline = SubtitleTimeline(_cues())
    timeline.anchor_to_cue(0)

    cue = timeline.move_next()

    assert cue is not None
    assert cue.index == 2
    assert timeline.playback_ms == 5_000


def test_visible_cues_include_overlap() -> None:
    cues = parse_srt_text(
        """
1
00:00:01,000 --> 00:00:04,000
first

2
00:00:02,000 --> 00:00:05,000
second
"""
    )
    timeline = SubtitleTimeline(cues, max_visible_cues=2)

    visible = timeline.visible_cues_at_time(2500)

    assert [cue.index for cue in visible] == [1, 2]


def test_visible_cues_respect_max_visible_limit() -> None:
    cues = parse_srt_text(
        """
1
00:00:01,000 --> 00:00:05,000
first

2
00:00:02,000 --> 00:00:05,000
second

3
00:00:03,000 --> 00:00:05,000
third
"""
    )
    timeline = SubtitleTimeline(cues, max_visible_cues=2)

    visible = timeline.visible_cues_at_time(3500)

    assert [cue.index for cue in visible] == [2, 3]


def test_format_visible_cues_joins_unique_sorted_text() -> None:
    from subtitle_sync.models import format_visible_cues

    cues = _cues()

    assert format_visible_cues([cues[1], cues[0], cues[1]]) == "first\nsecond"

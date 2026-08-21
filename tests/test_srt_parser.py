from __future__ import annotations

import pytest

from subtitle_sync.srt_parser import SrtParseError, parse_srt_text, parse_timestamp


def test_parse_timestamp_accepts_comma_and_dot() -> None:
    assert parse_timestamp("00:01:02,345") == 62345
    assert parse_timestamp("01:02:03.4") == 3723400


def test_parse_srt_text_with_multiline_html_and_notes() -> None:
    raw = """
1
00:00:01,000 --> 00:00:03,000
<i>太郎: こんにちは</i>
[music]

2
00:00:04,500 --> 00:00:06,000
今日は
いい天気ですね
"""
    cues = parse_srt_text(raw)

    assert len(cues) == 2
    assert cues[0].index == 1
    assert cues[0].start_ms == 1000
    assert cues[0].end_ms == 3000
    assert cues[0].text == "こんにちは"
    assert cues[1].text == "今日は\nいい天気ですね"
    assert " " not in cues[1].normalized_text


def test_parse_srt_rejects_missing_timing_line() -> None:
    with pytest.raises(SrtParseError):
        parse_srt_text("1\nこれは字幕です")

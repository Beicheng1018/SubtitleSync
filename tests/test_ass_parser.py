from __future__ import annotations

import pytest

from subtitle_sync.ass_parser import AssParseError, clean_ass_text, parse_ass_text, parse_ass_timestamp


def test_parse_ass_timestamp() -> None:
    assert parse_ass_timestamp("0:01:02.34") == 62340
    assert parse_ass_timestamp("1:02:03.4") == 3723400


def test_clean_ass_text_removes_styles_and_keeps_line_breaks() -> None:
    text = r"{\pos(100,200)}Hello\N{\i1}world{\i0}\h!"

    assert clean_ass_text(text) == "Hello\nworld !"


def test_parse_ass_dialogue_with_commas_and_multiline_text() -> None:
    raw = r"""
[Script Info]
Title: sample

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,{\an8}Hello, world\Nnext line
Comment: 0,0:00:04.00,0:00:05.00,Default,,0,0,0,,ignored
Dialogue: 0,0:00:06.00,0:00:08.00,Default,,0,0,0,,Second line
"""
    cues = parse_ass_text(raw)

    assert len(cues) == 2
    assert cues[0].index == 1
    assert cues[0].start_ms == 1000
    assert cues[0].end_ms == 3500
    assert cues[0].text == "Hello, world\nnext line"
    assert cues[1].text == "Second line"


def test_parse_ass_rejects_missing_events() -> None:
    with pytest.raises(AssParseError, match="Events"):
        parse_ass_text("[Script Info]\nTitle: sample")


def test_parse_ass_rejects_missing_format() -> None:
    raw = """
[Events]
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello
"""
    with pytest.raises(AssParseError, match="Format"):
        parse_ass_text(raw)


def test_parse_ass_rejects_missing_required_format_fields() -> None:
    raw = """
[Events]
Format: Start, End, Style
Dialogue: 0:00:01.00,0:00:02.00,Default
"""
    with pytest.raises(AssParseError, match="text"):
        parse_ass_text(raw)

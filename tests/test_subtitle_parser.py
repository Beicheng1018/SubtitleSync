from __future__ import annotations

import pytest

from subtitle_sync.subtitle_parser import SubtitleParseError, parse_subtitle_file, subtitle_format_for_path


def test_subtitle_format_for_supported_extensions() -> None:
    assert subtitle_format_for_path("episode.srt") == "SRT"
    assert subtitle_format_for_path("episode.ass") == "ASS"
    assert subtitle_format_for_path("episode.ssa") == "ASS"


def test_parse_subtitle_file_dispatches_srt_and_ass(tmp_path) -> None:
    srt_path = tmp_path / "episode.srt"
    srt_path.write_text("1\n00:00:01,000 --> 00:00:02,000\nHello\n", encoding="utf-8")

    ass_path = tmp_path / "episode.ass"
    ass_path.write_text(
        """
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello ASS
""",
        encoding="utf-8",
    )

    assert parse_subtitle_file(srt_path)[0].text == "Hello"
    assert parse_subtitle_file(ass_path)[0].text == "Hello ASS"


def test_parse_subtitle_file_rejects_unknown_extension(tmp_path) -> None:
    path = tmp_path / "episode.vtt"
    path.write_text("WEBVTT", encoding="utf-8")

    with pytest.raises(SubtitleParseError, match="Unsupported"):
        parse_subtitle_file(path)

from __future__ import annotations

from pathlib import Path

from .ass_parser import AssParseError, parse_ass_file
from .models import SubtitleCue
from .srt_parser import SrtParseError, parse_srt_file


class SubtitleParseError(ValueError):
    pass


def subtitle_format_for_path(path: str | Path) -> str:
    suffix = Path(path).suffix.lower()
    if suffix == ".srt":
        return "SRT"
    if suffix in {".ass", ".ssa"}:
        return "ASS"
    raise SubtitleParseError(f"Unsupported subtitle file type: {suffix or '(none)'}")


def parse_subtitle_file(path: str | Path) -> list[SubtitleCue]:
    subtitle_path = Path(path)
    subtitle_format = subtitle_format_for_path(subtitle_path)
    try:
        if subtitle_format == "SRT":
            return parse_srt_file(subtitle_path)
        return parse_ass_file(subtitle_path)
    except (SrtParseError, AssParseError) as exc:
        raise SubtitleParseError(str(exc)) from exc

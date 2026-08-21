from __future__ import annotations

import re
from pathlib import Path

from .models import SubtitleCue
from .text_utils import clean_subtitle_text, normalize_for_match

ASS_OVERRIDE_RE = re.compile(r"\{[^{}]*\}")
DRAWING_TEXT_RE = re.compile(r"^[mnlbspc\d\s.,+-]+$", re.IGNORECASE)


class AssParseError(ValueError):
    pass


def parse_ass_timestamp(value: str) -> int:
    match = re.fullmatch(r"(\d+):(\d{2}):(\d{2})[.](\d{1,3})", value.strip())
    if not match:
        raise AssParseError(f"Invalid ASS timestamp: {value}")
    hours, minutes, seconds, centiseconds = match.groups()
    fraction = int(centiseconds.ljust(3, "0")[:3])
    if len(centiseconds) <= 2:
        fraction = int(centiseconds.ljust(2, "0")) * 10
    return ((int(hours) * 60 + int(minutes)) * 60 + int(seconds)) * 1000 + fraction


def clean_ass_text(text: str) -> str:
    text = text.replace(r"\N", "\n").replace(r"\n", "\n").replace(r"\h", " ")
    text = ASS_OVERRIDE_RE.sub("", text)
    cleaned_lines = []
    for line in text.splitlines():
        line = line.strip()
        if DRAWING_TEXT_RE.fullmatch(line):
            continue
        if line:
            cleaned_lines.append(line)
    return clean_subtitle_text("\n".join(cleaned_lines))


def parse_ass_text(raw: str) -> list[SubtitleCue]:
    raw = raw.replace("\r\n", "\n").replace("\r", "\n").replace("\ufeff", "")
    in_events = False
    saw_events = False
    fields: list[str] | None = None
    cues: list[SubtitleCue] = []

    for line_number, raw_line in enumerate(raw.split("\n"), start=1):
        line = raw_line.strip()
        if not line or line.startswith(";"):
            continue

        if line.startswith("[") and line.endswith("]"):
            section = line.lower()
            in_events = section == "[events]"
            saw_events = saw_events or in_events
            continue

        if not in_events:
            continue

        key, separator, value = line.partition(":")
        if not separator:
            continue

        key_lower = key.strip().lower()
        if key_lower == "format":
            fields = [field.strip().lower() for field in value.split(",")]
            missing = {"start", "end", "text"} - set(fields)
            if missing:
                raise AssParseError(f"ASS Format is missing required fields: {', '.join(sorted(missing))}")
            continue

        if key_lower != "dialogue":
            continue

        if fields is None:
            raise AssParseError(f"Dialogue appears before Format at line {line_number}.")

        parts = value.lstrip().split(",", len(fields) - 1)
        if len(parts) < len(fields):
            continue

        values = dict(zip(fields, parts, strict=False))
        try:
            start_ms = parse_ass_timestamp(values["start"])
            end_ms = parse_ass_timestamp(values["end"])
        except AssParseError:
            continue

        display_text = clean_ass_text(values["text"])
        if not display_text:
            continue

        cues.append(
            SubtitleCue(
                index=len(cues) + 1,
                start_ms=start_ms,
                end_ms=end_ms,
                text=display_text,
                normalized_text=normalize_for_match(display_text),
            )
        )

    if not saw_events:
        raise AssParseError("ASS file is missing an [Events] section.")
    if fields is None:
        raise AssParseError("ASS file is missing an Events Format line.")
    if not cues:
        raise AssParseError("No valid ASS dialogue cues were found.")
    return cues


def parse_ass_file(path: str | Path) -> list[SubtitleCue]:
    ass_path = Path(path)
    last_error: UnicodeDecodeError | None = None
    for encoding in ("utf-8-sig", "utf-8", "cp932", "gb18030"):
        try:
            return parse_ass_text(ass_path.read_text(encoding=encoding))
        except UnicodeDecodeError as exc:
            last_error = exc
    raise AssParseError(f"Unable to decode ASS file: {last_error}")

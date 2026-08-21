from __future__ import annotations

import re
from pathlib import Path

from .models import SubtitleCue
from .text_utils import clean_subtitle_text, normalize_for_match

TIMING_RE = re.compile(
    r"(?P<start>\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*"
    r"(?P<end>\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})"
)


class SrtParseError(ValueError):
    pass


def parse_timestamp(value: str) -> int:
    match = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})", value.strip())
    if not match:
        raise SrtParseError(f"Invalid SRT timestamp: {value}")
    hours, minutes, seconds, millis = match.groups()
    ms = int(millis.ljust(3, "0")[:3])
    return ((int(hours) * 60 + int(minutes)) * 60 + int(seconds)) * 1000 + ms


def parse_srt_text(raw: str) -> list[SubtitleCue]:
    raw = raw.replace("\r\n", "\n").replace("\r", "\n").replace("\ufeff", "")
    blocks = re.split(r"\n{2,}", raw.strip())
    cues: list[SubtitleCue] = []

    for block_number, block in enumerate(blocks, start=1):
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue

        timing_line_index = next((i for i, line in enumerate(lines) if TIMING_RE.search(line)), -1)
        if timing_line_index < 0:
            raise SrtParseError(f"Block {block_number} is missing an SRT timing line.")

        timing_match = TIMING_RE.search(lines[timing_line_index])
        if timing_match is None:
            raise SrtParseError(f"Block {block_number} has an invalid timing line.")

        text_lines = lines[timing_line_index + 1 :]
        display_text = clean_subtitle_text("\n".join(text_lines))
        if not display_text:
            continue

        cue_index = len(cues) + 1
        if timing_line_index > 0 and lines[0].isdigit():
            cue_index = int(lines[0])

        cues.append(
            SubtitleCue(
                index=cue_index,
                start_ms=parse_timestamp(timing_match.group("start")),
                end_ms=parse_timestamp(timing_match.group("end")),
                text=display_text,
                normalized_text=normalize_for_match(display_text),
            )
        )

    if not cues:
        raise SrtParseError("No valid subtitle cues were found.")
    return cues


def parse_srt_file(path: str | Path) -> list[SubtitleCue]:
    srt_path = Path(path)
    last_error: UnicodeDecodeError | None = None
    for encoding in ("utf-8-sig", "utf-8", "cp932", "gb18030"):
        try:
            return parse_srt_text(srt_path.read_text(encoding=encoding))
        except UnicodeDecodeError as exc:
            last_error = exc
    raise SrtParseError(f"Unable to decode SRT file: {last_error}")

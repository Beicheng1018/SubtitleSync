from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .subtitle_parser import SubtitleParseError, parse_subtitle_file, subtitle_format_for_path


def parse_subtitle_payload(path: str | Path) -> dict[str, Any]:
    subtitle_path = Path(path)
    subtitle_format = subtitle_format_for_path(subtitle_path)
    cues = parse_subtitle_file(subtitle_path)
    return {
        "ok": True,
        "format": subtitle_format,
        "fileName": subtitle_path.name,
        "path": str(subtitle_path),
        "cues": [asdict(cue) for cue in cues],
    }


def error_payload(message: str) -> dict[str, Any]:
    return {"ok": False, "error": message}


def print_payload(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=True))


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 2 or args[0] != "parse":
        print_payload(error_payload("Usage: electron_bridge parse <subtitle-file>"))
        return 2

    try:
        payload = parse_subtitle_payload(args[1])
    except (OSError, SubtitleParseError, ValueError) as exc:
        payload = error_payload(str(exc))

    print_payload(payload)
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

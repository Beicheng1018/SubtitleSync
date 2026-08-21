from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


CONFIG_PATH = Path(__file__).resolve().parents[2] / "config.json"


@dataclass
class AppConfig:
    font_family: str = "Microsoft YaHei"
    font_size: int = 34
    window_opacity: float = 0.82
    always_on_top: bool = True
    click_through: bool = False
    floating_x: int = 240
    floating_y: int = 680
    floating_width: int = 840
    floating_height: int = 140
    subtitle_display_max_lines: int = 2
    timeline_tick_ms: int = 100
    main_window_x: int = 80
    main_window_y: int = 80
    main_window_width: int = 420
    main_window_height: int = 132

    @classmethod
    def load(cls, path: Path = CONFIG_PATH) -> "AppConfig":
        if not path.exists():
            return cls()
        try:
            data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return cls()
        defaults = asdict(cls())
        defaults.update({key: value for key, value in data.items() if key in defaults})
        return cls(**defaults)

    def save(self, path: Path = CONFIG_PATH) -> None:
        path.write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2), encoding="utf-8")

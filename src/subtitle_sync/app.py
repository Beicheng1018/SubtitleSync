from __future__ import annotations

import sys
from pathlib import Path


if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from subtitle_sync.ui.main_window import run_app
else:
    from .ui.main_window import run_app


def main() -> int:
    return run_app()


if __name__ == "__main__":
    raise SystemExit(main())

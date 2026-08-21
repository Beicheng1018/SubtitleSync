from __future__ import annotations

import json

from subtitle_sync.config import AppConfig


def test_config_ignores_removed_asr_and_audio_fields(tmp_path) -> None:
    path = tmp_path / "config.json"
    path.write_text(
        json.dumps(
            {
                "audio_device": "Speakers",
                "audio_source_mode": "process_loopback",
                "sherpa_model_dir": "models/legacy",
                "match_threshold": 62.0,
                "sample_rate": 16000,
                "font_size": 28,
            }
        ),
        encoding="utf-8",
    )

    config = AppConfig.load(path)

    assert config.font_size == 28
    assert not hasattr(config, "audio_device")
    assert not hasattr(config, "sherpa_model_dir")
    assert not hasattr(config, "match_threshold")
    assert not hasattr(config, "sample_rate")


def test_config_defaults_to_manual_player_values() -> None:
    config = AppConfig()

    assert config.font_size == 34
    assert config.window_opacity == 0.82
    assert config.always_on_top is True
    assert config.subtitle_display_max_lines == 2
    assert config.timeline_tick_ms == 100


def test_config_save_writes_only_current_fields(tmp_path) -> None:
    path = tmp_path / "config.json"
    config = AppConfig(font_size=30, window_opacity=0.5)

    config.save(path)

    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["font_size"] == 30
    assert data["window_opacity"] == 0.5
    assert "sherpa_model_dir" not in data
    assert "audio_source_mode" not in data

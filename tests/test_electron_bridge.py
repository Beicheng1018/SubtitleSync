from __future__ import annotations

import json

from subtitle_sync.electron_bridge import main, parse_subtitle_payload


def test_parse_subtitle_payload_serializes_cues(tmp_path) -> None:
    path = tmp_path / "sample.srt"
    path.write_text("1\n00:00:01,000 --> 00:00:02,000\nHello\n", encoding="utf-8")

    payload = parse_subtitle_payload(path)

    assert payload["ok"] is True
    assert payload["format"] == "SRT"
    assert payload["fileName"] == "sample.srt"
    assert payload["cues"][0]["start_ms"] == 1000
    assert payload["cues"][0]["text"] == "Hello"


def test_bridge_cli_reports_unsupported_extension(tmp_path, capsys) -> None:
    path = tmp_path / "sample.vtt"
    path.write_text("WEBVTT", encoding="utf-8")

    exit_code = main(["parse", str(path)])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert exit_code == 1
    assert payload["ok"] is False
    assert "Unsupported" in payload["error"]


def test_bridge_cli_outputs_ascii_safe_json_for_unicode_subtitles(tmp_path, capsys) -> None:
    path = tmp_path / "unicode.srt"
    path.write_text(
        "1\n00:00:01,000 --> 00:00:02,000\n今日はいい天気ですね・字幕\n",
        encoding="utf-8",
    )

    exit_code = main(["parse", str(path)])

    captured = capsys.readouterr()
    captured.out.encode("gbk")
    payload = json.loads(captured.out)
    assert exit_code == 0
    assert payload["ok"] is True
    assert payload["cues"][0]["text"] == "今日はいい天気ですね・字幕"


def test_bridge_cli_reports_usage_error(capsys) -> None:
    exit_code = main([])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert exit_code == 2
    assert payload["ok"] is False
    assert "Usage" in payload["error"]

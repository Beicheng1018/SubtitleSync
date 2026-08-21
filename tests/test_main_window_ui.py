from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication

from subtitle_sync.ui.main_window import MainWindow, format_timestamp


def _app() -> QApplication:
    return QApplication.instance() or QApplication([])


def _subtitle_file(tmp_path: Path) -> Path:
    path = tmp_path / "sample.srt"
    path.write_text(
        """
1
00:00:01,000 --> 00:00:03,000
first

2
00:00:05,000 --> 00:00:06,000
second
""".strip(),
        encoding="utf-8",
    )
    return path


def test_format_timestamp_uses_compact_minutes_by_default() -> None:
    assert format_timestamp(65_432) == "01:05.432"
    assert format_timestamp(3_665_432) == "01:01:05.432"


def test_main_window_defaults_to_compact_upload_state() -> None:
    _app()
    window = MainWindow()

    assert window.upload_btn.text() == "上传字幕文件"
    assert not window.settings_btn.isVisible()
    assert not window.subtitle_list.isVisible()
    assert window.windowFlags() & Qt.WindowType.WindowStaysOnTopHint
    assert window.height() <= 120
    window.close()


def test_loading_subtitle_reveals_file_and_list(tmp_path) -> None:
    _app()
    window = MainWindow()
    subtitle_path = _subtitle_file(tmp_path)

    window.load_subtitle_file(subtitle_path)

    assert not window.settings_btn.isHidden()
    assert not window.subtitle_list.isHidden()
    assert "sample.srt" in window.file_info_label.text()
    assert window.subtitle_list.count() == 2
    assert "00:01.000 - 00:03.000" in window.subtitle_list.item(0).text()
    window.close()


def test_clicking_subtitle_selects_and_updates_floating_window(tmp_path) -> None:
    _app()
    window = MainWindow()
    subtitle_path = _subtitle_file(tmp_path)
    window.load_subtitle_file(subtitle_path)

    item = window.subtitle_list.item(1)
    window.subtitle_list.itemClicked.emit(item)

    assert window.current_position == 1
    assert window.subtitle_list.currentItem() is item
    assert window.floating_window.label.text() == "second"
    assert window.floating_window.isVisible()
    window.close()


def test_floating_controls_move_and_toggle_playback(tmp_path) -> None:
    _app()
    window = MainWindow()
    subtitle_path = _subtitle_file(tmp_path)
    window.load_subtitle_file(subtitle_path)
    window._select_position(0)

    window.floating_window.next_button.click()
    assert window.current_position == 1
    assert window.floating_window.label.text() == "second"

    window.floating_window.play_pause_button.click()
    assert window.playing
    assert window.floating_window.play_pause_button.text() == "暂停"

    window.floating_window.play_pause_button.click()
    assert not window.playing
    assert window.floating_window.play_pause_button.text() == "开始"
    window.close()

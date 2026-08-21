from __future__ import annotations

from PySide6.QtWidgets import QApplication

from subtitle_sync.ui.floating_window import FloatingSubtitleWindow
from subtitle_sync.ui.floating_window import WindowGeometry, resize_mode_at_point, resized_geometry


def _app() -> QApplication:
    return QApplication.instance() or QApplication([])


def test_resize_mode_at_point_detects_edges_and_corners() -> None:
    width = 200
    height = 100

    assert resize_mode_at_point(0, 0, width, height) == "top-left"
    assert resize_mode_at_point(199, 0, width, height) == "top-right"
    assert resize_mode_at_point(0, 99, width, height) == "bottom-left"
    assert resize_mode_at_point(199, 99, width, height) == "bottom-right"
    assert resize_mode_at_point(0, 50, width, height) == "left"
    assert resize_mode_at_point(199, 50, width, height) == "right"
    assert resize_mode_at_point(100, 0, width, height) == "top"
    assert resize_mode_at_point(100, 99, width, height) == "bottom"
    assert resize_mode_at_point(100, 50, width, height) is None


def test_resized_geometry_resizes_from_right_and_bottom() -> None:
    start = WindowGeometry(x=10, y=20, width=840, height=140)

    geometry = resized_geometry(start, dx=60, dy=30, mode="bottom-right")

    assert geometry == WindowGeometry(x=10, y=20, width=900, height=170)


def test_resized_geometry_resizes_from_left_and_top() -> None:
    start = WindowGeometry(x=10, y=20, width=840, height=140)

    geometry = resized_geometry(start, dx=40, dy=10, mode="top-left")

    assert geometry == WindowGeometry(x=50, y=30, width=800, height=130)


def test_resized_geometry_clamps_to_minimum_size() -> None:
    start = WindowGeometry(x=10, y=20, width=840, height=140)

    geometry = resized_geometry(start, dx=500, dy=80, mode="top-left", min_width=360, min_height=120)

    assert geometry == WindowGeometry(x=490, y=40, width=360, height=120)


def test_floating_window_control_buttons_emit_signals() -> None:
    _app()
    window = FloatingSubtitleWindow()
    events: list[str] = []
    window.previous_requested.connect(lambda: events.append("previous"))
    window.play_pause_requested.connect(lambda: events.append("play"))
    window.next_requested.connect(lambda: events.append("next"))

    window.previous_button.click()
    window.play_pause_button.click()
    window.next_button.click()

    assert events == ["previous", "play", "next"]
    window.close()


def test_floating_window_playing_state_changes_button_text() -> None:
    _app()
    window = FloatingSubtitleWindow()

    window.set_playing(True)
    assert window.play_pause_button.text() == "暂停"
    window.set_playing(False)
    assert window.play_pause_button.text() == "开始"
    window.close()


def test_floating_window_close_action_hides_without_destroying() -> None:
    _app()
    window = FloatingSubtitleWindow()
    window.show()

    window._close_floating_window()

    assert not window.isVisible()
    window.show()
    assert window.isVisible()
    window.close()

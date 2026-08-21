from __future__ import annotations

from dataclasses import dataclass

from PySide6.QtCore import QPoint, QRect, Qt, Signal
from PySide6.QtGui import QColor, QFont
from PySide6.QtWidgets import QGraphicsDropShadowEffect, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget


DEFAULT_FLOATING_GEOMETRY = (240, 680, 840, 140)
RESIZE_MARGIN_PX = 8
MIN_FLOATING_WIDTH = 360
MIN_FLOATING_HEIGHT = 120
ResizeMode = str | None


@dataclass(frozen=True)
class WindowGeometry:
    x: int
    y: int
    width: int
    height: int


def resize_mode_at_point(x: int, y: int, width: int, height: int, margin: int = RESIZE_MARGIN_PX) -> ResizeMode:
    if width <= 0 or height <= 0:
        return None

    left = x <= margin
    right = x >= width - margin
    top = y <= margin
    bottom = y >= height - margin

    if top and left:
        return "top-left"
    if top and right:
        return "top-right"
    if bottom and left:
        return "bottom-left"
    if bottom and right:
        return "bottom-right"
    if left:
        return "left"
    if right:
        return "right"
    if top:
        return "top"
    if bottom:
        return "bottom"
    return None


def resized_geometry(
    start: WindowGeometry,
    dx: int,
    dy: int,
    mode: str,
    min_width: int = MIN_FLOATING_WIDTH,
    min_height: int = MIN_FLOATING_HEIGHT,
) -> WindowGeometry:
    x = start.x
    y = start.y
    width = start.width
    height = start.height

    if "left" in mode:
        width = start.width - dx
        x = start.x + dx
        if width < min_width:
            width = min_width
            x = start.x + start.width - min_width
    elif "right" in mode:
        width = max(min_width, start.width + dx)

    if "top" in mode:
        height = start.height - dy
        y = start.y + dy
        if height < min_height:
            height = min_height
            y = start.y + start.height - min_height
    elif "bottom" in mode:
        height = max(min_height, start.height + dy)

    return WindowGeometry(x=x, y=y, width=width, height=height)


class FloatingSubtitleWindow(QWidget):
    geometry_changed = Signal(int, int, int, int)
    previous_requested = Signal()
    play_pause_requested = Signal()
    next_requested = Signal()

    def __init__(
        self,
        x: int = DEFAULT_FLOATING_GEOMETRY[0],
        y: int = DEFAULT_FLOATING_GEOMETRY[1],
        width: int = DEFAULT_FLOATING_GEOMETRY[2],
        height: int = DEFAULT_FLOATING_GEOMETRY[3],
    ) -> None:
        super().__init__()
        self._drag_start: QPoint | None = None
        self._resize_mode: ResizeMode = None
        self._resize_start_pos: QPoint | None = None
        self._resize_start_geometry: WindowGeometry | None = None
        self._geometry_changed_pending = False
        self._opacity = 0.82
        self._always_on_top = True
        self._click_through = False

        self.setWindowTitle("SubtitleSync 悬浮字幕")
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setWindowFlag(Qt.WindowType.FramelessWindowHint, True)
        self.setWindowFlag(Qt.WindowType.Tool, True)
        self.setMinimumSize(MIN_FLOATING_WIDTH, MIN_FLOATING_HEIGHT)
        self.setMouseTracking(True)

        self.label = QLabel("字幕将在这里显示")
        self.label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.label.setWordWrap(True)
        self.label.setMargin(18)
        self.label.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)

        shadow = QGraphicsDropShadowEffect(self.label)
        shadow.setBlurRadius(9)
        shadow.setColor(QColor(0, 0, 0, 220))
        shadow.setOffset(0, 2)
        self.label.setGraphicsEffect(shadow)

        self.previous_button = QPushButton("上一句")
        self.play_pause_button = QPushButton("开始")
        self.next_button = QPushButton("下一句")
        self.previous_button.clicked.connect(self.previous_requested.emit)
        self.play_pause_button.clicked.connect(self.play_pause_requested.emit)
        self.next_button.clicked.connect(self.next_requested.emit)

        controls = QHBoxLayout()
        controls.setContentsMargins(0, 0, 0, 0)
        controls.setSpacing(8)
        controls.addStretch()
        controls.addWidget(self.previous_button)
        controls.addWidget(self.play_pause_button)
        controls.addWidget(self.next_button)
        controls.addStretch()

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(8)
        layout.addWidget(self.label, 1)
        layout.addLayout(controls)

        self.setGeometry(x, y, max(MIN_FLOATING_WIDTH, width), max(MIN_FLOATING_HEIGHT, height))
        self.apply_style("Microsoft YaHei", 34, self._opacity, self._always_on_top, self._click_through)

    def set_subtitle(self, text: str) -> None:
        self.label.setText(text or "字幕将在这里显示")

    def set_playing(self, playing: bool) -> None:
        self.play_pause_button.setText("暂停" if playing else "开始")

    def apply_style(
        self,
        font_family: str,
        font_size: int,
        opacity: float,
        always_on_top: bool,
        click_through: bool,
    ) -> None:
        self._opacity = max(0.15, min(1.0, opacity))
        self._always_on_top = always_on_top
        self._click_through = click_through

        self.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint, always_on_top)
        self.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, click_through)
        self.label.setFont(QFont(font_family or "Microsoft YaHei", max(12, font_size)))
        background_alpha = int(185 * self._opacity)
        self.label.setStyleSheet(
            f"""
            QLabel {{
                color: rgba(255, 255, 255, {int(255 * self._opacity)});
                background-color: rgba(0, 0, 0, {background_alpha});
                border: 1px solid rgba(255, 255, 255, {int(70 * self._opacity)});
                border-radius: 8px;
                padding: 10px 16px;
            }}
            """
        )
        controls_alpha = int(220 * self._opacity)
        for button in (self.previous_button, self.play_pause_button, self.next_button):
            button.setEnabled(not click_through)
            button.setStyleSheet(
                f"""
                QPushButton {{
                    color: rgba(255, 255, 255, {int(245 * self._opacity)});
                    background-color: rgba(31, 41, 55, {controls_alpha});
                    border: 1px solid rgba(255, 255, 255, {int(75 * self._opacity)});
                    border-radius: 6px;
                    padding: 4px 12px;
                    font-size: 12px;
                    min-width: 58px;
                }}
                QPushButton:hover {{
                    background-color: rgba(55, 65, 81, {int(240 * self._opacity)});
                }}
                QPushButton:disabled {{
                    background-color: rgba(90, 98, 112, {int(120 * self._opacity)});
                }}
                """
            )
        if self.isVisible():
            self.show()

    def apply_saved_geometry(self, x: int, y: int, width: int, height: int) -> None:
        self.setGeometry(x, y, max(MIN_FLOATING_WIDTH, width), max(MIN_FLOATING_HEIGHT, height))

    def _current_geometry(self) -> WindowGeometry:
        geometry = self.geometry()
        return WindowGeometry(geometry.x(), geometry.y(), geometry.width(), geometry.height())

    def _resize_mode_for_event(self, event) -> ResizeMode:
        position = event.position().toPoint()
        return resize_mode_at_point(position.x(), position.y(), self.width(), self.height())

    def _update_cursor(self, mode: ResizeMode) -> None:
        if self._click_through:
            self.unsetCursor()
            return
        if mode in {"left", "right"}:
            self.setCursor(Qt.CursorShape.SizeHorCursor)
        elif mode in {"top", "bottom"}:
            self.setCursor(Qt.CursorShape.SizeVerCursor)
        elif mode in {"top-left", "bottom-right"}:
            self.setCursor(Qt.CursorShape.SizeFDiagCursor)
        elif mode in {"top-right", "bottom-left"}:
            self.setCursor(Qt.CursorShape.SizeBDiagCursor)
        else:
            self.unsetCursor()

    def _emit_geometry_changed(self) -> None:
        geometry = self.geometry()
        self.geometry_changed.emit(geometry.x(), geometry.y(), geometry.width(), geometry.height())

    def _close_floating_window(self) -> None:
        self.close()

    def mousePressEvent(self, event) -> None:
        if self._click_through:
            return
        if event.button() == Qt.MouseButton.RightButton:
            self._close_floating_window()
            event.accept()
            return
        if event.button() == Qt.MouseButton.LeftButton:
            resize_mode = self._resize_mode_for_event(event)
            if resize_mode is not None:
                self._resize_mode = resize_mode
                self._resize_start_pos = event.globalPosition().toPoint()
                self._resize_start_geometry = self._current_geometry()
                self._geometry_changed_pending = True
                event.accept()
                return
            self._drag_start = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            self._geometry_changed_pending = True
            event.accept()

    def mouseMoveEvent(self, event) -> None:
        if self._click_through:
            return
        if (
            self._resize_mode is not None
            and self._resize_start_pos is not None
            and self._resize_start_geometry is not None
            and event.buttons() & Qt.MouseButton.LeftButton
        ):
            current_pos = event.globalPosition().toPoint()
            dx = current_pos.x() - self._resize_start_pos.x()
            dy = current_pos.y() - self._resize_start_pos.y()
            geometry = resized_geometry(self._resize_start_geometry, dx, dy, self._resize_mode)
            self.setGeometry(QRect(geometry.x, geometry.y, geometry.width, geometry.height))
            event.accept()
            return
        if self._drag_start is not None and event.buttons() & Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self._drag_start)
            event.accept()
            return
        self._update_cursor(self._resize_mode_for_event(event))

    def mouseReleaseEvent(self, event) -> None:
        self._drag_start = None
        self._resize_mode = None
        self._resize_start_pos = None
        self._resize_start_geometry = None
        self._update_cursor(self._resize_mode_for_event(event))
        if self._geometry_changed_pending:
            self._geometry_changed_pending = False
            self._emit_geometry_changed()
        event.accept()

    def leaveEvent(self, event) -> None:
        if self._resize_mode is None:
            self.unsetCursor()
        super().leaveEvent(event)

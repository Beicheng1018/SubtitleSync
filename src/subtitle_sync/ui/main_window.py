from __future__ import annotations

import time
from pathlib import Path

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QApplication,
    QDialog,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSlider,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)

from ..config import AppConfig
from ..models import SubtitleCue, format_visible_cues
from ..subtitle_parser import SubtitleParseError, parse_subtitle_file, subtitle_format_for_path
from ..timeline import SubtitleTimeline
from .floating_window import FloatingSubtitleWindow


def format_timestamp(ms: int) -> str:
    ms = max(0, ms)
    hours, remainder = divmod(ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1000)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"
    return f"{minutes:02d}:{seconds:02d}.{millis:03d}"


class SettingsDialog(QDialog):
    def __init__(self, config: AppConfig, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("设置")
        self.setModal(True)
        self.setMinimumWidth(320)

        self.font_size_spin = QSpinBox()
        self.font_size_spin.setRange(12, 72)
        self.font_size_spin.setValue(config.font_size)

        self.opacity_slider = QSlider(Qt.Orientation.Horizontal)
        self.opacity_slider.setRange(15, 100)
        self.opacity_slider.setValue(int(config.window_opacity * 100))
        self.opacity_label = QLabel(f"{self.opacity_slider.value()}%")
        self.opacity_slider.valueChanged.connect(lambda value: self.opacity_label.setText(f"{value}%"))

        opacity_row = QHBoxLayout()
        opacity_row.addWidget(self.opacity_slider)
        opacity_row.addWidget(self.opacity_label)

        form = QFormLayout()
        form.addRow("字幕字号", self.font_size_spin)
        form.addRow("背景透明度", opacity_row)

        self.save_button = QPushButton("保存")
        self.cancel_button = QPushButton("取消")
        self.save_button.clicked.connect(self.accept)
        self.cancel_button.clicked.connect(self.reject)

        actions = QHBoxLayout()
        actions.addStretch()
        actions.addWidget(self.cancel_button)
        actions.addWidget(self.save_button)

        root = QVBoxLayout(self)
        root.addLayout(form)
        root.addLayout(actions)
        self.setStyleSheet(
            """
            QDialog { background: #101418; color: #eef2f7; }
            QLabel { color: #d7dde6; }
            QSpinBox {
                background: #171d24;
                color: #eef2f7;
                border: 1px solid #2d3744;
                border-radius: 6px;
                padding: 5px 8px;
            }
            QPushButton {
                background: #2f6feb;
                color: white;
                border: 0;
                border-radius: 6px;
                padding: 7px 14px;
            }
            QPushButton:hover { background: #3b7cff; }
            """
        )

    def apply_to(self, config: AppConfig) -> None:
        config.font_size = int(self.font_size_spin.value())
        config.window_opacity = float(self.opacity_slider.value()) / 100.0


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.config = AppConfig.load()
        self.cues: list[SubtitleCue] = []
        self.subtitle_path: Path | None = None
        self.timeline = SubtitleTimeline([], max_visible_cues=self.config.subtitle_display_max_lines)
        self.current_position = -1
        self.playing = False
        self.paused_playback_ms = 0
        self.play_anchor_ms = 0
        self.play_anchor_time = 0.0

        self.floating_window = FloatingSubtitleWindow(
            x=self.config.floating_x,
            y=self.config.floating_y,
            width=self.config.floating_width,
            height=self.config.floating_height,
        )
        self.floating_window.geometry_changed.connect(self._handle_floating_geometry_changed)
        self.floating_window.previous_requested.connect(self._move_previous)
        self.floating_window.play_pause_requested.connect(self._toggle_playback)
        self.floating_window.next_requested.connect(self._move_next)

        self.play_timer = QTimer(self)
        self.play_timer.setInterval(max(30, int(self.config.timeline_tick_ms)))
        self.play_timer.timeout.connect(self._advance_playback)

        self.setWindowTitle("SubtitleSync")
        self.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint, True)
        self.setMinimumWidth(340)
        self._build_ui()
        self._apply_app_style()
        self._apply_settings_to_floating()
        self.resize(self.config.main_window_width, self.config.main_window_height)
        self.move(self.config.main_window_x, self.config.main_window_y)
        self._set_loaded_state(False)

    def _build_ui(self) -> None:
        root_widget = QWidget()
        root = QVBoxLayout(root_widget)
        root.setContentsMargins(12, 12, 12, 12)
        root.setSpacing(8)

        top_row = QHBoxLayout()
        self.upload_btn = QPushButton("上传字幕文件")
        self.upload_btn.clicked.connect(self._choose_subtitle)
        self.settings_btn = QPushButton("设置")
        self.settings_btn.clicked.connect(self._open_settings)
        top_row.addWidget(self.upload_btn, 1)
        top_row.addWidget(self.settings_btn)
        root.addLayout(top_row)

        self.file_info_label = QLabel("")
        self.file_info_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        root.addWidget(self.file_info_label)

        self.subtitle_list = QListWidget()
        self.subtitle_list.setUniformItemSizes(False)
        self.subtitle_list.setVerticalScrollMode(QListWidget.ScrollMode.ScrollPerPixel)
        self.subtitle_list.setMaximumHeight(360)
        self.subtitle_list.itemClicked.connect(self._handle_item_clicked)
        root.addWidget(self.subtitle_list)

        self.setCentralWidget(root_widget)

    def _apply_app_style(self) -> None:
        self.setStyleSheet(
            """
            QMainWindow, QWidget {
                background: #101418;
                color: #eef2f7;
                font-size: 13px;
            }
            QPushButton {
                background: #243040;
                color: #f7fafc;
                border: 1px solid #3a4657;
                border-radius: 6px;
                padding: 7px 10px;
            }
            QPushButton:hover { background: #2d3a4d; }
            QPushButton:pressed { background: #1d2633; }
            QLabel { color: #cbd5e1; }
            QListWidget {
                background: #151b22;
                color: #e5edf7;
                border: 1px solid #2c3542;
                border-radius: 6px;
                outline: 0;
            }
            QListWidget::item {
                border-bottom: 1px solid #222b36;
                padding: 8px;
            }
            QListWidget::item:selected {
                background: #2f6feb;
                color: #ffffff;
            }
            QScrollBar:vertical {
                background: #111720;
                width: 10px;
                margin: 0;
            }
            QScrollBar::handle:vertical {
                background: #3b4656;
                border-radius: 5px;
                min-height: 32px;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0;
            }
            """
        )

    def _set_loaded_state(self, loaded: bool) -> None:
        self.settings_btn.setVisible(loaded)
        self.file_info_label.setVisible(loaded)
        self.subtitle_list.setVisible(loaded)
        self.setFixedHeight(520 if loaded else 72)

    def _choose_subtitle(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "选择字幕文件",
            "",
            "字幕文件 (*.srt *.ass *.ssa);;SRT 字幕 (*.srt);;ASS/SSA 字幕 (*.ass *.ssa);;所有文件 (*.*)",
        )
        if not path:
            return
        self.load_subtitle_file(path)

    def load_subtitle_file(self, path: str | Path) -> None:
        try:
            subtitle_format = subtitle_format_for_path(path)
            cues = parse_subtitle_file(path)
        except SubtitleParseError as exc:
            QMessageBox.warning(self, "字幕解析失败", str(exc))
            return

        self._stop_playback()
        self.subtitle_path = Path(path)
        self.cues = cues
        self.timeline = SubtitleTimeline(cues, max_visible_cues=self.config.subtitle_display_max_lines)
        self.current_position = -1
        self.paused_playback_ms = cues[0].start_ms if cues else 0
        self.file_info_label.setText(f"{self.subtitle_path.name}  ·  {subtitle_format}  ·  {len(cues)} 条")
        self._populate_subtitle_list()
        self._set_loaded_state(True)
        self.resize(self.config.main_window_width, 520)

    def _populate_subtitle_list(self) -> None:
        self.subtitle_list.clear()
        for position, cue in enumerate(self.cues):
            item = QListWidgetItem(self._item_text(cue))
            item.setData(Qt.ItemDataRole.UserRole, position)
            self.subtitle_list.addItem(item)

    def _item_text(self, cue: SubtitleCue) -> str:
        return f"{format_timestamp(cue.start_ms)} - {format_timestamp(cue.end_ms)}\n{cue.text}"

    def _handle_item_clicked(self, item: QListWidgetItem) -> None:
        position = item.data(Qt.ItemDataRole.UserRole)
        if isinstance(position, int):
            self._select_position(position, show_floating=True)

    def _select_position(self, position: int, show_floating: bool = True) -> None:
        cue = self.timeline.anchor_to_cue(position)
        if cue is None:
            return
        self.current_position = self.timeline.current_pos
        self.paused_playback_ms = cue.start_ms
        self._sync_current_selection(scroll=True)
        self._show_visible_cues(self.timeline.visible_cues_at_time(cue.start_ms))
        if self.playing:
            self._restart_anchor_from(cue.start_ms)
        if show_floating:
            self.floating_window.show()
            self.floating_window.raise_()

    def _sync_current_selection(self, scroll: bool) -> None:
        if not (0 <= self.current_position < self.subtitle_list.count()):
            return
        item = self.subtitle_list.item(self.current_position)
        self.subtitle_list.setCurrentItem(item)
        if scroll:
            self.subtitle_list.scrollToItem(item, QListWidget.ScrollHint.PositionAtCenter)

    def _show_visible_cues(self, cues: list[SubtitleCue]) -> None:
        if not cues:
            return
        self.floating_window.set_subtitle(format_visible_cues(cues))

    def _toggle_playback(self) -> None:
        if not self.cues:
            return
        if self.current_position < 0:
            self._select_position(0)
        if self.playing:
            self._pause_playback()
        else:
            self._start_playback()

    def _start_playback(self) -> None:
        self.playing = True
        self._restart_anchor_from(self.paused_playback_ms)
        self.floating_window.set_playing(True)
        self.play_timer.start()

    def _pause_playback(self) -> None:
        self.paused_playback_ms = self._current_playback_ms()
        self.playing = False
        self.play_timer.stop()
        self.floating_window.set_playing(False)

    def _stop_playback(self) -> None:
        self.playing = False
        self.play_timer.stop()
        self.floating_window.set_playing(False)

    def _restart_anchor_from(self, playback_ms: int) -> None:
        self.play_anchor_ms = max(0, int(playback_ms))
        self.play_anchor_time = time.monotonic()
        self.paused_playback_ms = self.play_anchor_ms

    def _current_playback_ms(self) -> int:
        if not self.playing:
            return self.paused_playback_ms
        elapsed_ms = int((time.monotonic() - self.play_anchor_time) * 1000)
        return max(0, self.play_anchor_ms + elapsed_ms)

    def _advance_playback(self) -> None:
        playback_ms = self._current_playback_ms()
        result = self.timeline.advance_to(playback_ms)
        self.paused_playback_ms = playback_ms
        if result.changed:
            self.current_position = result.position
            self._sync_current_selection(scroll=True)
            self._show_visible_cues(result.cues)
        if self.cues and playback_ms > self.cues[-1].end_ms:
            self._pause_playback()

    def _move_previous(self) -> None:
        if not self.cues:
            return
        target = max(0, self.current_position - 1 if self.current_position >= 0 else 0)
        self._select_position(target)

    def _move_next(self) -> None:
        if not self.cues:
            return
        target = min(len(self.cues) - 1, self.current_position + 1 if self.current_position >= 0 else 0)
        self._select_position(target)

    def _open_settings(self) -> None:
        dialog = SettingsDialog(self.config, self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        dialog.apply_to(self.config)
        self.config.save()
        self._apply_settings_to_floating()

    def _apply_settings_to_floating(self) -> None:
        self.floating_window.apply_style(
            self.config.font_family,
            self.config.font_size,
            self.config.window_opacity,
            self.config.always_on_top,
            self.config.click_through,
        )

    def _handle_floating_geometry_changed(self, x: int, y: int, width: int, height: int) -> None:
        self.config.floating_x = x
        self.config.floating_y = y
        self.config.floating_width = width
        self.config.floating_height = height
        self.config.save()

    def closeEvent(self, event) -> None:
        self._stop_playback()
        geometry = self.geometry()
        self.config.main_window_x = geometry.x()
        self.config.main_window_y = geometry.y()
        self.config.main_window_width = geometry.width()
        self.config.main_window_height = 520 if self.cues else 120
        floating_geometry = self.floating_window.geometry()
        self.config.floating_x = floating_geometry.x()
        self.config.floating_y = floating_geometry.y()
        self.config.floating_width = floating_geometry.width()
        self.config.floating_height = floating_geometry.height()
        self.config.save()
        self.floating_window.close()
        super().closeEvent(event)


def run_app() -> int:
    app = QApplication.instance() or QApplication([])
    window = MainWindow()
    window.show()
    return app.exec()

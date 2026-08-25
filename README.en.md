# SubtitleSync

[简体中文](README.md) | **English**

SubtitleSync is a lightweight local subtitle player and browser video synchronization tool. Its desktop interface is built with Electron, while subtitle parsing and timeline logic reuse Python modules. It supports `.srt`, `.ass`, and `.ssa` subtitle files.

## Features

- Load `.srt`, `.ass`, and `.ssa` subtitles and play them using their own timeline.
- Click any subtitle line to display it immediately and use it as the playback start position.
- Play, pause, move to the previous or next subtitle, and adjust timing backward or forward by 0.5 seconds.
- Display subtitles in a resizable, always-on-top floating window with collapsible controls.
- Right-click the floating window to hide it without unloading subtitles or stopping background state.
- Synchronize play, pause, progress, fast-forward, and rewind events from browser videos through the optional Chrome/Edge extension.
- Smoothly scroll long file names while keeping the subtitle extension visible.
- Unload the current subtitle without deleting the local source file.
- Automatically save font size, background opacity, window positions, and the minimize-to-tray-on-close preference.
- Use a system tray menu to restore the main window or exit the application completely.
- Use custom application icons and build a Windows NSIS installer with shortcuts.

## Architecture

- Electron: main window, floating subtitle window, system tray, and browser synchronization bridge.
- Node.js: Electron main process and local HTTP event forwarding.
- Python 3.10+: SRT/ASS/SSA parsing and subtitle timeline logic.
- PySide6: retained Python desktop fallback interface.
- Chrome/Edge Manifest V3 extension: captures web video events and forwards them to the local app.

## Requirements

- Node.js and npm.
- Python 3.10 or later.
- Windows is the current packaging target; development mode runs through Electron.

## Installation

Install the Node.js dependencies:

```powershell
npm install
```

Install the Python dependencies if you want to run the fallback interface or tests:

```powershell
python -m pip install -r requirements.txt
```

Electron uses the `python` command by default. To select a specific interpreter, set `PYTHON_EXE` before starting the app:

```powershell
$env:PYTHON_EXE="C:\path\to\python.exe"
npm start
```

## Starting and Stopping

Start Electron with npm:

```powershell
npm start
```

You can also double-click or run:

```powershell
.\start.bat
```

`start.bat` first tries `D:\Anaconda\python.exe` and falls back to the `python` command if that path does not exist. Edit `PYTHON_EXE` in the script when needed.

Stop this project's Electron development process with:

```powershell
.\stop.bat
```

Start the retained PySide6 fallback interface with:

```powershell
python run.py
```

## Basic Usage

1. Start SubtitleSync.
2. Click `上传字幕文件` and select an `.srt`, `.ass`, or `.ssa` file.
3. Click any line in the subtitle list to display it in the floating window and establish the starting position.
4. Use the main-window or floating-window controls to play, pause, or adjust the subtitle position.
5. Click `移除字幕` to unload the subtitle without deleting its local source file.

The settings button is in the main window title bar. It controls subtitle font size, floating-window background opacity, and whether closing the main window minimizes the app to the system tray. Minimize to tray is enabled by default. To exit completely, use `退出程序` in the tray menu or disable this setting first.

## Browser Video Synchronization

SubtitleSync can follow play, pause, fast-forward, and rewind actions from Chrome or Edge web videos.

1. Start SubtitleSync.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Click `Load unpacked` and select the project's `browser-extension/` directory.
5. Load a subtitle in SubtitleSync and click the subtitle line that should be used as the synchronization start point.
6. Play, pause, fast-forward, or rewind the browser video. The subtitle timeline will update accordingly.

The extension sends video events to `http://127.0.0.1:37655/browser-video-event`. SubtitleSync calculates the subtitle position from the video's actual `currentTime` and the current subtitle offset. The extension does not parse subtitle files.

After changing files in `browser-extension/`, reload the extension on the browser's extension management page and refresh any video pages that were already open.

## Windows Packaging

Generate an unpacked Windows application directory:

```powershell
npm run pack
```

Generate a Windows NSIS installer:

```powershell
npm run dist
```

Build artifacts are written to `release/`. The installer creates SubtitleSync desktop and Start menu shortcuts.

## Tests

Run the Electron static smoke check:

```powershell
npm run check
```

Run the Python test suite:

```powershell
python -m pytest
```

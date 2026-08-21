# SubtitleSync

SubtitleSync is a lightweight manual subtitle playback controller. The desktop UI is built with Electron, while the existing Python subtitle parsers are reused for `.srt`, `.ass`, and `.ssa` files.

## Features

- Upload `.srt`, `.ass`, and `.ssa` subtitle files.
- Click any subtitle line to show it immediately in the floating subtitle window.
- Play, pause, and jump to previous or next subtitle by the subtitle file's own timeline.
- Keep overlapping subtitle lines visible together.
- Use a transparent always-on-top floating subtitle window.
- Auto-save font size, background opacity, and window geometry in `config.json`.
- Use a compact themed title bar instead of the system title bar.
- Sync subtitle play/pause and seek offsets with browser videos through the optional Chrome/Edge extension.

## Install

```powershell
npm install
```

Python 3 must be available as `python`, or set `PYTHON_EXE` before starting Electron:

```powershell
$env:PYTHON_EXE="D:\Anaconda\python.exe"
```

## Start

```powershell
npm start
```

The main window starts compactly with only `上传字幕文件`. After loading a subtitle file, it expands to show the file name, settings button, and a scrollable subtitle list.

## Browser video link

SubtitleSync can follow play, pause, forward, and rewind events from videos in Chrome or Edge.

1. Start SubtitleSync with `npm start`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable developer mode.
4. Click `Load unpacked` and select the `browser-extension/` folder.
5. Load subtitles in SubtitleSync and click the subtitle line you want to use as the start point.
6. Play, pause, fast-forward, or rewind a browser video; the subtitle timeline will follow it.

After updating files in `browser-extension/`, click the extension reload button in the browser extension page and refresh the video page. Existing pages keep running the old content script until they are refreshed.

The extension sends video `play`, `pause`, throttled `progress`, `seek-start`, and `seek` events to `http://127.0.0.1:37655/browser-video-event`. SubtitleSync keeps one relative subtitle offset and calculates each target position from the video's actual `currentTime`; it freezes its internal clock while a seek is in progress. It does not perform subtitle parsing.

## Tests

```powershell
python -m pytest
npm run check
```

The previous PySide entry point is still present as a fallback while the Electron frontend settles.

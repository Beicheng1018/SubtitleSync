# SubtitleSync

[简体中文](README.md) | **English**

SubtitleSync is a simple **floating subtitle display tool**.

You can load local subtitle files and play them along their timeline. When watching videos in Chrome or Edge, you can also use the browser extension to keep subtitles synchronized with video playback, pauses, and seeking.

It supports `.srt`, `.ass`, and `.ssa` subtitles.

## Main Features

- Supports SRT, ASS, and SSA subtitles
- Click any subtitle line to start playback from that position
- Play, pause, move to the previous subtitle, or move to the next subtitle
- Fine-tune subtitle timing forward or backward
- Use an independent, freely resizable floating subtitle window
- Keep the subtitle window always on top for use with web videos
- Adjust subtitle font size and background transparency
- Synchronize with Chrome and Edge videos
- Automatically save window positions and subtitle settings
- Minimize the application to the system tray
- Remove loaded subtitles without deleting the original files

## Basic Usage

1. Open SubtitleSync.
2. Click **Upload Subtitle File** (`上传字幕文件`).
3. Select an `.srt`, `.ass`, or `.ssa` subtitle file.
4. Click a line in the subtitle list to choose the starting position.
5. Click Play, and the subtitles will be displayed automatically according to the timeline.

During playback, use controls such as **Previous, Next, and Pause** to adjust the subtitles.

## Browser Video Synchronization

To synchronize subtitles with a video on a web page, install the Chrome / Edge extension included with the project.

1. Open `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the project's `browser-extension` folder
5. Start SubtitleSync and load a subtitle file
6. Play the web video

The video's **play, pause, fast-forward, and rewind** actions will then be synchronized with the subtitles automatically.

## Settings

Click **Settings** at the top of the main window to adjust:

- Subtitle font size
- Floating-window background transparency
- Whether closing the window minimizes the application to the system tray

These settings are saved automatically and restored the next time the application starts.

When **Minimize to tray on close** is enabled, closing the main window does not exit the application.

To exit completely, select **Exit Application** (`退出程序`) from the system tray menu.

## Development

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm start
```

You can also run:

```bash
start.bat
```

## Windows Packaging

Generate the Windows installer:

```bash
npm run dist
```

The packaged files are written to:

```text
release/
```

The installer automatically creates desktop and Start menu shortcuts.

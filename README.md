# SubtitleSync

**简体中文** | [English](README.en.md)

SubtitleSync 是一款轻量级的本地字幕播放与浏览器视频同步工具。桌面界面基于 Electron，字幕解析与时间轴逻辑复用 Python 模块，支持 `.srt`、`.ass` 和 `.ssa` 字幕文件。

## 功能

- 加载 `.srt`、`.ass` 和 `.ssa` 字幕，并通过字幕自身的时间轴播放。
- 点击任意字幕行，从该位置开始显示或播放字幕。
- 支持播放、暂停、上一句、下一句以及前后微调 0.5 秒。
- 在可调整尺寸、始终置顶的独立悬浮窗中显示字幕，并支持折叠控制栏。
- 右键悬浮窗可直接隐藏，不会卸载字幕或停止后台状态。
- 通过可选的 Chrome/Edge 扩展同步浏览器视频的播放、暂停、进度、快进和回退。
- 文件名过长时平滑滚动，字幕扩展名始终固定显示。
- 可移除当前字幕而不删除本地字幕源文件。
- 自动保存字幕字号、背景不透明度、窗口位置和“关闭时最小化到托盘”等设置。
- 提供系统托盘菜单，可显示主窗口或完整退出程序。
- 使用自定义应用图标，并支持生成 Windows NSIS 安装包及快捷方式。

## 技术结构

- Electron：主窗口、字幕悬浮窗、系统托盘及浏览器同步桥接服务。
- Node.js：Electron 主进程与本地 HTTP 事件转发。
- Python 3.10+：SRT/ASS/SSA 解析和字幕时间轴逻辑。
- PySide6：保留的 Python 桌面回退界面。
- Chrome/Edge Manifest V3 扩展：采集网页视频事件并发送到本地应用。

## 环境要求

- Node.js 与 npm。
- Python 3.10 或更高版本。
- Windows 是当前正式打包目标；开发模式使用 Electron 启动。

## 安装

安装 Node.js 依赖：

```powershell
npm install
```

如需运行 Python 回退界面或测试，安装 Python 依赖：

```powershell
python -m pip install -r requirements.txt
```

Electron 默认调用命令行中的 `python`。如需指定解释器，请在启动前设置 `PYTHON_EXE`：

```powershell
$env:PYTHON_EXE="C:\path\to\python.exe"
npm start
```

## 启动与停止

使用 npm 启动 Electron：

```powershell
npm start
```

也可以双击或从命令行运行：

```powershell
.\start.bat
```

`start.bat` 会优先尝试 `D:\Anaconda\python.exe`，该路径不存在时回退到命令行中的 `python`。如有需要，可修改脚本中的 `PYTHON_EXE`。

停止当前项目的 Electron 开发进程：

```powershell
.\stop.bat
```

保留的 PySide6 回退界面可通过以下命令启动：

```powershell
python run.py
```

## 基本使用

1. 启动 SubtitleSync。
2. 点击“上传字幕文件”，选择 `.srt`、`.ass` 或 `.ssa` 文件。
3. 点击字幕列表中的任意一行，在悬浮窗中显示该字幕并确定起始位置。
4. 使用主窗口或悬浮窗中的控制按钮播放、暂停或调整字幕位置。
5. 如需卸载字幕，点击“移除字幕”；该操作不会删除本地文件。

设置按钮位于主窗口标题栏。可调整字幕字号、悬浮窗背景不透明度，以及是否在关闭主窗口时最小化到系统托盘。该托盘选项默认开启；若要真正退出，请使用托盘菜单中的“退出程序”，或先关闭该设置。

## 浏览器视频同步

SubtitleSync 可以跟随 Chrome 或 Edge 网页视频的播放、暂停、快进和回退。

1. 启动 SubtitleSync。
2. 打开 `chrome://extensions` 或 `edge://extensions`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择项目中的 `browser-extension/` 目录。
5. 在 SubtitleSync 中加载字幕，并点击要作为同步起点的字幕行。
6. 播放、暂停、快进或回退浏览器视频，字幕时间轴会同步更新。

扩展会将视频事件发送到本机的 `http://127.0.0.1:37655/browser-video-event`。SubtitleSync 根据视频实际的 `currentTime` 和当前字幕偏移计算字幕位置；扩展本身不解析字幕。

修改 `browser-extension/` 中的文件后，需要在浏览器扩展管理页重新加载扩展，并刷新已经打开的视频页面。

## Windows 打包

生成未安装的 Windows 应用目录：

```powershell
npm run pack
```

生成 Windows NSIS 安装包：

```powershell
npm run dist
```

打包结果输出到 `release/`。安装程序会创建名为 SubtitleSync 的桌面快捷方式和开始菜单快捷方式。

## 测试

运行 Electron 静态冒烟检查：

```powershell
npm run check
```

运行 Python 测试：

```powershell
python -m pytest
```

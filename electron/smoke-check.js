const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { isResizeEdge, resizedBounds } = require('./floating-resize');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'electron/main.js',
  'electron/floating-resize.js',
  'electron/windows-no-activate.js',
  'electron/preload.js',
  'electron/renderer/index.html',
  'electron/renderer/floating.html',
  'electron/renderer/main-renderer.js',
  'electron/renderer/floating-renderer.js',
  'electron/renderer/styles.css',
  'assets/icon.ico',
  'assets/icon.png',
  'build.bat',
  'browser-extension/manifest.json',
  'browser-extension/background.js',
  'browser-extension/content.js',
  'src/subtitle_sync/electron_bridge.py'
];

const textFiles = requiredFiles.filter((file) => /\.(?:js|html|py)$/.test(file));
const mojibakePatterns = [
  '涓',
  '瀛',
  '鏂',
  '璁',
  '寮',
  '鏆',
  '鎵',
  '搴',
  '鍙',
  '淇',
  '瑙',
  '澶',
  '辫',
  '触'
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

for (const file of textFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const pattern of mojibakePatterns) {
    if (content.includes(pattern)) {
      throw new Error(`Possible mojibake "${pattern}" found in ${file}`);
    }
  }
  if (content.includes('?/span') || content.includes('?/button')) {
    throw new Error(`Malformed HTML-like tag found in ${file}`);
  }
}

const mainJs = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const floatingResizeJs = fs.readFileSync(path.join(root, 'electron/floating-resize.js'), 'utf8');
const windowsNoActivateJs = fs.readFileSync(path.join(root, 'electron/windows-no-activate.js'), 'utf8');
const preloadJs = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
const rendererJs = fs.readFileSync(path.join(root, 'electron/renderer/main-renderer.js'), 'utf8');
const floatingRendererJs = fs.readFileSync(path.join(root, 'electron/renderer/floating-renderer.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(root, 'electron/renderer/styles.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'electron/renderer/index.html'), 'utf8');
const floatingHtml = fs.readFileSync(path.join(root, 'electron/renderer/floating.html'), 'utf8');
const extensionManifest = fs.readFileSync(path.join(root, 'browser-extension/manifest.json'), 'utf8');
const extensionBackground = fs.readFileSync(path.join(root, 'browser-extension/background.js'), 'utf8');
const extensionContent = fs.readFileSync(path.join(root, 'browser-extension/content.js'), 'utf8');
const buildBat = fs.readFileSync(path.join(root, 'build.bat'), 'utf8');

for (const expected of ['--no-pause', 'ELECTRON_MIRROR=', 'ELECTRON_BUILDER_BINARIES_MIRROR=', 'npm run check', '-m pytest', '--win nsis portable --publish never', 'BUILD_EXIT_CODE']) {
  if (!buildBat.includes(expected)) {
    throw new Error(`Missing expected Windows build script behavior: ${expected}`);
  }
}

for (const expected of ['http.createServer', 'BROWSER_BRIDGE_PORT = 37655', 'browser-video:', 'progress', 'invalid_progress_time', 'seek-start', 'invalid_seek_start', 'invalid_seek_delta', 'playingAfterSeek', 'floating:preview-config', 'floating:adjust-playback', 'control:adjust-playback', "ipcMain.handle('floating:hide'", 'hideFloatingWindow', 'hideFloatingFromContextMenu', 'releaseMouseCapture()', "webContents.on('context-menu'", "floatingWindow.on('system-context-menu'", 'setTimeout(() =>', 'mainWindow.isVisible()', 'mainWindow.focus()', 'floatingWindow.hide()', 'frame: false', 'thickFrame: false', 'COMPACT_MAIN_HEIGHT = 132', 'backgroundThrottling: false', 'keepFloatingWindowOnTop', "setAlwaysOnTop(true, 'screen-saver')", 'applyNoActivateStyle(floatingWindow)', 'hasNoActivateStyle(floatingWindow)', 'floating-no-activate-style-missing', "floatingWindow.on('focus', keepFloatingWindowOnTop)", "floatingWindow.on('blur', keepFloatingWindowOnTop)", 'showInactive()', "ipcMain.handle('window:toggle-always-on-top'", "ipcMain.handle('window:minimize'", "ipcMain.handle('window:close'", "ipcMain.handle('floating:show', (_event, options = {})", 'if (!options.preserveControlsState)', 'FLOATING_EXPANDED_MIN_HEIGHT = 120', 'FLOATING_COLLAPSED_MIN_HEIGHT = 84', 'floatingControlsCollapsed', 'floatingControlsHeightDelta', 'setFloatingControlsCollapsed(false)', "ipcMain.handle('floating:set-controls-collapsed'", 'screen.getDisplayMatching', 'bounds.height + floatingControlsHeightDelta', "ipcMain.on('floating:resize-begin'", "ipcMain.on('floating:resize-update'", "ipcMain.on('floating:resize-end'", 'screen.getCursorScreenPoint()', 'floatingResizeSession', 'resizedBounds(', 'Tray', 'Menu', 'APP_ICON_NAME', 'APP_ICON_PATH', 'process.resourcesPath', "'assets'", 'icon.ico', 'icon.png', 'minimizeToTrayOnClose: true', 'createTray()', '显示主窗口', '退出程序', 'event.preventDefault()', 'mainWindow.hide()', 'isQuitting', 'destroyTray()', 'icon: APP_ICON_PATH']) {
  if (!mainJs.includes(expected)) {
    throw new Error(`Missing expected main-process behavior: ${expected}`);
  }
}
for (const expected of ['WS_EX_NOACTIVATE = 0x08000000n', "require('koffi')", "koffi.load('user32.dll')", 'GetWindowLongPtrW', 'SetWindowLongPtrW', 'SetWindowPos', 'ReleaseCapture', 'releaseMouseCapture', 'getNativeWindowHandle()', 'currentStyle | WS_EX_NOACTIVATE', 'SWP_NOACTIVATE', 'SWP_FRAMECHANGED', 'hasNoActivateStyle']) {
  if (!windowsNoActivateJs.includes(expected)) {
    throw new Error(`Missing Windows no-activate behavior: ${expected}`);
  }
}
for (const forbidden of ['focusable: false', 'setFocusable(false)']) {
  if (mainJs.includes(forbidden)) {
    throw new Error(`Floating window must remain interactive: ${forbidden}`);
  }
}
for (const expected of ['showFloating: (options = {})', "ipcRenderer.invoke('floating:show', options)", 'previewFloatingConfig', 'hideFloating', 'setFloatingControlsCollapsed', 'onFloatingControlsCollapsed', 'beginFloatingResize', 'updateFloatingResize', 'endFloatingResize', 'onBrowserVideoPlay', 'onBrowserVideoPause', 'onBrowserVideoProgress', 'onBrowserVideoSeekStart', 'onBrowserVideoSeek', 'adjustPlayback', 'onAdjustPlaybackRequested', 'toggleMainAlwaysOnTop', 'minimizeMainWindow', 'closeMainWindow']) {
  if (!preloadJs.includes(expected)) {
    throw new Error(`Missing expected preload API: ${expected}`);
  }
}
for (const expected of ['settingsBtn', '⚙', 'pinBtn', '上传字幕文件', 'fileNameViewport', 'fileNameScroller', 'fileExtension', '移除字幕', '重新选择', '设置', '字幕字号', '背景不透明度', '关闭窗口时最小化到托盘', 'minimizeToTrayInput', '调整后会自动保存', 'SubtitleSync']) {
  if (!indexHtml.includes(expected)) {
    throw new Error(`Missing expected UI text in index.html: ${expected}`);
  }
}
if (!/id="settingsBtn"[^>]*>⚙<\/button>\s*<button id="pinBtn"/.test(indexHtml)) {
  throw new Error('Settings button must appear before the pin button in the title bar');
}
if (/loaded-header[\s\S]*id="settingsBtn"/.test(indexHtml)) {
  throw new Error('Settings button must not remain in the loaded subtitle header');
}
for (const expected of ['字幕将在这里显示', '字幕回退 0.5 秒', '-0.5s', '上一句', '开始', '下一句', '+0.5s', '字幕快进 0.5 秒', 'rewindHalfSecondBtn', 'forwardHalfSecondBtn', 'floatingControls', 'controlsToggleBtn', 'controls-toggle-chevron', 'aria-hidden="true"', '折叠控制按钮', 'aria-expanded="true"', 'data-resize-edge="top"', 'data-resize-edge="bottom-right"']) {
  if (!floatingHtml.includes(expected)) {
    throw new Error(`Missing expected UI text in floating.html: ${expected}`);
  }
}
for (const expected of ['previewFloatingConfig', 'handleBrowserVideoPlay', 'handleBrowserVideoPause', 'handleBrowserVideoProgress', 'handleBrowserVideoSeekStart', 'handleBrowserVideoSeek', 'adjustPlaybackBy', 'effectiveAdjustmentMs', 'onAdjustPlaybackRequested', 'browserSeek', 'subtitleOffsetMs', 'videoTimeMs + state.subtitleOffsetMs', 'toTime * 1000 + state.subtitleOffsetMs', 'hasAbsoluteSeekTarget', 'basePlaybackMs + deltaSeconds * 1000', 'browserVideoTimeMs', 'syncPlaybackToBrowser', 'BROWSER_PROGRESS_CORRECTION_THRESHOLD_MS = 120', 'frozenPlaybackMs', 'resumePlaying', 'playingAfterSeek', 'applyPlaybackPosition', 'clampPlaybackMs', 'subtitleList.scrollTop = 0', 'api.hideFloating()', 'syncFloatingPlayButton', 'syncPinButton', 'toggleMainAlwaysOnTop', 'ensurePlaybackTimer', 'playbackIntervalMs', 'scheduleSettingsSave', 'minimizeToTrayInput', 'minimizeToTrayOnClose', '已自动保存', '正在保存...', 'splitSubtitleFileName', 'scrollWidth - fileNameViewport.clientWidth', 'FILE_NAME_SCROLL_SPEED_PX_PER_SECOND = 30', 'ResizeObserver', 'pauseFileNameAnimation', 'resumeFileNameAnimation', 'cleanupFileNameAnimation', 'removeSubtitleBtn', 'removeSubtitle', 'state.cues = []', 'setLoadedState(false)', 'reselectBtn', 'minimizeMainWindow', 'closeMainWindow']) {
  if (!rendererJs.includes(expected)) {
    throw new Error(`Missing expected renderer behavior: ${expected}`);
  }
}
for (const forbidden of ['browserClock', 'setBrowserClockAnchor']) {
  if (rendererJs.includes(forbidden)) {
    throw new Error(`Renderer must not retain the old browser clock anchor model: ${forbidden}`);
  }
}
if (!/function handleBrowserVideoSeek\(payload\)[\s\S]*?api\.showFloating\(\{ preserveControlsState: true \}\);\s*\n\}/.test(rendererJs)) {
  throw new Error('Browser video seek must show the floating window without expanding its controls');
}
for (const expected of ['.file-name-viewport', 'overflow: hidden', '.file-name-scroller', 'will-change: transform', '.file-extension', 'flex: 0 0 auto', 'prefers-reduced-motion: reduce']) {
  if (!stylesCss.includes(expected)) {
    throw new Error(`Missing expected file name scrolling style: ${expected}`);
  }
}
if (floatingRendererJs.includes('--text-alpha')) {
  throw new Error('floating-renderer.js must not apply background opacity to subtitle text');
}
for (const expected of ['floatingRoot', 'configuredOpacity', 'backgroundOpacity', 'boxShadow = backgroundOpacity <= 0.001', "'none'", '--glass-alpha', '--glass-blur', '--glass-highlight-alpha', '--glass-border-alpha', 'floatingRoot.style.background', 'floatingRoot.style.backdropFilter', 'floatingRoot.style.webkitBackdropFilter', 'floatingRoot.style.borderColor', 'subtitleText.style.color']) {
  if (!floatingRendererJs.includes(expected)) {
    throw new Error(`Missing expected direct floating subtitle style update: ${expected}`);
  }
}
for (const forbidden of ['--glass-shadow-alpha', '0 12px 32px']) {
  if (floatingRendererJs.includes(forbidden) || stylesCss.includes(forbidden)) {
    throw new Error(`Floating subtitle must not render an outer black shadow: ${forbidden}`);
  }
}
for (const expected of ['rewindHalfSecondBtn', 'forwardHalfSecondBtn', 'api.adjustPlayback(-500)', 'api.adjustPlayback(500)']) {
  if (!floatingRendererJs.includes(expected)) {
    throw new Error(`Missing floating subtitle adjustment control: ${expected}`);
  }
}
for (const expected of ['controlsToggleBtn', 'measureControlsHeightDelta', 'getComputedStyle(floatingRoot).rowGap', 'controls-collapsed', 'setFloatingControlsCollapsed', 'onFloatingControlsCollapsed', '展开控制按钮', '折叠控制按钮']) {
  if (!floatingRendererJs.includes(expected)) {
    throw new Error(`Missing floating controls collapse behavior: ${expected}`);
  }
}
if (
  floatingRendererJs.includes('controlsToggleBtn.textContent')
  || floatingHtml.includes('▴')
  || floatingHtml.includes('▾')
) {
  throw new Error('Floating controls toggle must use the animated CSS chevron');
}
for (const expected of ['resizeHandles', 'bindResizeHandle', 'setPointerCapture', 'requestAnimationFrame', 'beginFloatingResize', 'updateFloatingResize', 'endFloatingResize', 'lostpointercapture']) {
  if (!floatingRendererJs.includes(expected)) {
    throw new Error(`Missing floating edge resize behavior: ${expected}`);
  }
}
for (const expected of ['class="floating-document"']) {
  if (!floatingHtml.includes(expected)) {
    throw new Error(`Missing floating document transparency marker: ${expected}`);
  }
}
for (const expected of ['html.floating-document', 'background: transparent !important']) {
  if (!stylesCss.includes(expected)) {
    throw new Error(`Missing transparent floating document style: ${expected}`);
  }
}
for (const expected of ['blurPixels', 'backgroundOpacity * 16', "? 'transparent'", 'floatingRoot.style.borderColor = backgroundOpacity <= 0.001']) {
  if (!floatingRendererJs.includes(expected)) {
    throw new Error(`Missing proportional floating background effect: ${expected}`);
  }
}
if (!floatingRendererJs.includes('floatingRoot.style.background') || !floatingRendererJs.includes('rgba(0, 0, 0, ${backgroundOpacity})')) {
  throw new Error('Floating subtitle background must use a solid black color');
}
for (const forbidden of ['subtitleText.style.background', 'subtitleText.style.borderColor', 'subtitleText.style.boxShadow', 'subtitleText.style.backdropFilter']) {
  if (floatingRendererJs.includes(forbidden)) {
    throw new Error(`Subtitle text must not own the unified panel style: ${forbidden}`);
  }
}
if (floatingRendererJs.includes('linear-gradient') || stylesCss.includes('rgba(8, 12, 20, var(--glass-alpha')) {
  throw new Error('Floating subtitle background must not use the old gradient');
}
if (floatingRendererJs.includes('1 - transparency')) {
  throw new Error('floating-renderer.js must interpret window_opacity as background opacity directly');
}
if (!indexHtml.includes('id="opacityInput" type="range" min="0" max="100"')) {
  throw new Error('Background opacity slider must cover 0% through 100%');
}
if (stylesCss.includes('var(--text-alpha')) {
  throw new Error('styles.css must keep floating subtitle text fully opaque');
}
for (const expected of ['.floating-root', 'color: #ffffff', '--glass-alpha', '--glass-border-alpha', 'backdrop-filter', '-webkit-backdrop-filter', 'background: rgba(0, 0, 0', '.floating-subtitle', 'background: transparent', 'border: 0', 'box-shadow: none', 'flex-wrap: nowrap', 'pointer-events: auto', '-webkit-app-region: no-drag', '.nudge-button', 'min-width: 52px', '.floating-root.controls-collapsed', '.controls-collapsed .floating-controls', '.controls-toggle', 'grid-template-rows: minmax(0, 1fr) auto 24px', 'width: 60px', 'height: 24px', 'margin-bottom: -8px', 'border-radius: 8px 8px 0 0', 'width: 66px', '.controls-toggle-chevron', 'transform: rotate(-135deg)', '.controls-collapsed .controls-toggle-chevron', 'transform: rotate(45deg)', '180ms ease', '.resize-handle', 'touch-action: none', 'cursor: ns-resize', 'cursor: ew-resize', 'cursor: nwse-resize', 'cursor: nesw-resize']) {
  if (!stylesCss.includes(expected)) {
    throw new Error(`Missing expected floating subtitle style: ${expected}`);
  }
}
for (const expected of [
  /\.resize-top,\s*\.resize-bottom\s*\{[^}]*left:\s*24px;[^}]*right:\s*24px;[^}]*height:\s*12px;/s,
  /\.resize-left,\s*\.resize-right\s*\{[^}]*top:\s*24px;[^}]*bottom:\s*24px;[^}]*width:\s*12px;/s,
  /\.resize-top-left,\s*\.resize-top-right,\s*\.resize-bottom-left,\s*\.resize-bottom-right\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/s
]) {
  if (!expected.test(stylesCss)) {
    throw new Error(`Floating resize hit area does not match: ${expected}`);
  }
}

for (const edge of ['top', 'right', 'bottom', 'left', 'top-left', 'top-right', 'bottom-left', 'bottom-right']) {
  assert.equal(isResizeEdge(edge), true);
}
assert.deepEqual(
  resizedBounds({ x: 10, y: 20, width: 840, height: 140 }, 60, 30, 'bottom-right', 360, 120),
  { x: 10, y: 20, width: 900, height: 170 }
);
assert.deepEqual(
  resizedBounds({ x: 10, y: 20, width: 840, height: 140 }, 600, 80, 'top-left', 360, 120),
  { x: 490, y: 40, width: 360, height: 120 }
);
if (!floatingResizeJs.includes('startRight - next.width') || !floatingResizeJs.includes('startBottom - next.height')) {
  throw new Error('Floating resize geometry must keep the opposite edge anchored');
}
for (const expected of ['"manifest_version": 3', '"service_worker": "background.js"', '"content.js"', 'http://127.0.0.1:37655/*']) {
  if (!extensionManifest.includes(expected)) {
    throw new Error(`Missing expected browser extension manifest behavior: ${expected}`);
  }
}
for (const expected of ['BRIDGE_URL', 'browser-video-event', "value.event === 'progress'", "value.event === 'seek-start'", "value.event === 'seek'", 'deltaSeconds', 'sendQueue', 'enqueueVideoPayload', 'fetch(BRIDGE_URL']) {
  if (!extensionBackground.includes(expected)) {
    throw new Error(`Missing expected browser extension background behavior: ${expected}`);
  }
}
for (const expected of ['HTMLVideoElement', "sendVideoEvent('play'", "sendVideoEvent('pause'", "sendVideoEvent('progress'", "sendVideoEvent('seek-start'", "sendVideoEvent('seek'", 'seeking', 'seeked', 'lastStableTime', 'lastProgressSentAt', 'PROGRESS_SEND_INTERVAL_MS = 250', 'seekFrom', 'seekId', 'nextSeekId', 'wasPlayingBeforeSeek', 'playingAfterSeek', 'suppressTimeupdateUntil', 'TIMEUPDATE_AFTER_SEEK_SUPPRESSION_MS', 'lastSeekSentAt', 'TIMEUPDATE_JUMP_THRESHOLD_SECONDS', 'SEEK_THRESHOLD_SECONDS', 'subtitle-sync-video-event']) {
  if (!extensionContent.includes(expected)) {
    throw new Error(`Missing expected browser extension content behavior: ${expected}`);
  }
}
if (extensionContent.includes('state.lastTime')) {
  throw new Error('browser-extension/content.js must not write the removed state.lastTime field');
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageJson.scripts.start !== 'electron .') {
  throw new Error('package.json must expose npm start as "electron ."');
}
if (!packageJson.devDependencies || !packageJson.devDependencies.electron) {
  throw new Error('package.json must include electron as a dev dependency');
}
if (!packageJson.devDependencies || !packageJson.devDependencies['electron-builder']) {
  throw new Error('package.json must include electron-builder for Windows packaging');
}
if (!packageJson.dependencies || !packageJson.dependencies.koffi) {
  throw new Error('package.json must include koffi for the Windows no-activate window style');
}
if (
  packageJson.scripts.pack !== 'electron-builder --dir --win'
  || packageJson.scripts.dist !== 'electron-builder --win nsis'
) {
  throw new Error('package.json must expose the expected electron-builder packaging scripts');
}
const buildConfig = packageJson.build;
if (
  !buildConfig
  || buildConfig.appId !== 'com.subtitlesync.app'
  || !buildConfig.files?.includes('electron/**/*')
  || !buildConfig.files?.includes('src/**/*')
  || !buildConfig.files?.includes('package.json')
  || buildConfig.directories?.buildResources !== 'assets'
  || buildConfig.directories?.output !== 'release'
  || buildConfig.win?.icon !== 'assets/icon.ico'
  || !buildConfig.win?.target?.includes('nsis')
  || buildConfig.nsis?.installerIcon !== 'assets/icon.ico'
  || buildConfig.nsis?.uninstallerIcon !== 'assets/icon.ico'
  || buildConfig.nsis?.shortcutName !== 'SubtitleSync'
  || !buildConfig.nsis?.createDesktopShortcut
  || !buildConfig.nsis?.createStartMenuShortcut
) {
  throw new Error('electron-builder Windows and shortcut icon configuration is incomplete');
}
if (!buildConfig.extraResources?.some((resource) => resource.from === 'assets' && resource.to === 'assets')) {
  throw new Error('electron-builder must copy runtime icon resources into the packaged app');
}

console.log('electron-smoke-ok');

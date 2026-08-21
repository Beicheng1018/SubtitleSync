const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { isResizeEdge, resizedBounds } = require('./floating-resize');
const { applyNoActivateStyle, hasNoActivateStyle } = require('./windows-no-activate');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const DEBUG_LOG_PATH = path.join(ROOT, 'electron-debug.log');
const COMPACT_MAIN_HEIGHT = 132;
const LOADED_MAIN_HEIGHT = 520;
const BROWSER_BRIDGE_HOST = '127.0.0.1';
const BROWSER_BRIDGE_PORT = 37655;
const FLOATING_MIN_WIDTH = 360;
const FLOATING_EXPANDED_MIN_HEIGHT = 120;
const FLOATING_COLLAPSED_MIN_HEIGHT = 84;
const DEFAULT_FLOATING_CONTROLS_HEIGHT_DELTA = 36;

function debugLog(message) {
  if (process.env.SUBTITLE_SYNC_DEBUG !== '1') {
    return;
  }
  fs.appendFileSync(DEBUG_LOG_PATH, `${new Date().toISOString()} ${message}\n`, 'utf8');
}

process.on('uncaughtException', (error) => {
  debugLog(`uncaughtException: ${error.stack || error.message}`);
  console.error(error);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const message = reason && reason.stack ? reason.stack : String(reason);
  debugLog(`unhandledRejection: ${message}`);
  console.error(reason);
});

const DEFAULT_CONFIG = {
  font_family: 'Microsoft YaHei',
  font_size: 34,
  window_opacity: 0.82,
  always_on_top: true,
  click_through: false,
  floating_x: 240,
  floating_y: 680,
  floating_width: 840,
  floating_height: 140,
  subtitle_display_max_lines: 2,
  timeline_tick_ms: 100,
  main_window_x: 80,
  main_window_y: 80,
  main_window_width: 420,
  main_window_height: COMPACT_MAIN_HEIGHT
};

let mainWindow = null;
let floatingWindow = null;
let floatingControlsCollapsed = false;
let floatingControlsHeightDelta = DEFAULT_FLOATING_CONTROLS_HEIGHT_DELTA;
let floatingResizeSession = null;
let browserBridgeServer = null;
let config = loadConfig();

function sanitizeConfig(value) {
  const sanitized = { ...DEFAULT_CONFIG };
  if (!value || typeof value !== 'object') {
    return sanitized;
  }
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      sanitized[key] = value[key];
    }
  }
  return sanitized;
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return sanitizeConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(partial = {}) {
  config = sanitizeConfig({ ...config, ...partial });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

function keepFloatingWindowOnTop() {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    return;
  }
  floatingWindow.setAlwaysOnTop(true, 'screen-saver');
  applyNoActivateStyle(floatingWindow);
  if (process.platform === 'darwin') {
    floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
}

function floatingControlsState() {
  return {
    collapsed: floatingControlsCollapsed,
    heightDelta: floatingControlsHeightDelta
  };
}

function sendFloatingControlsState() {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('floating:controls-collapsed', floatingControlsState());
  }
}

function normalizeFloatingControlsHeightDelta(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return floatingControlsHeightDelta || DEFAULT_FLOATING_CONTROLS_HEIGHT_DELTA;
  }
  return Math.max(24, Math.min(80, parsed));
}

function clearFloatingResizeSession() {
  floatingResizeSession = null;
}

function setFloatingControlsCollapsed(collapsed, requestedHeightDelta) {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    return { collapsed: false, heightDelta: DEFAULT_FLOATING_CONTROLS_HEIGHT_DELTA };
  }

  const nextCollapsed = Boolean(collapsed);
  clearFloatingResizeSession();
  if (nextCollapsed === floatingControlsCollapsed) {
    sendFloatingControlsState();
    return floatingControlsState();
  }

  const bounds = floatingWindow.getBounds();
  if (nextCollapsed) {
    floatingControlsHeightDelta = normalizeFloatingControlsHeightDelta(requestedHeightDelta);
    floatingControlsCollapsed = true;
    floatingWindow.setMinimumSize(FLOATING_MIN_WIDTH, FLOATING_COLLAPSED_MIN_HEIGHT);
    floatingWindow.setBounds({
      ...bounds,
      height: Math.max(
        FLOATING_COLLAPSED_MIN_HEIGHT,
        bounds.height - floatingControlsHeightDelta
      )
    });
  } else {
    const targetHeight = Math.max(
      FLOATING_EXPANDED_MIN_HEIGHT,
      bounds.height + floatingControlsHeightDelta
    );
    const display = screen.getDisplayMatching({ ...bounds, height: targetHeight });
    const workArea = display.workArea;
    const maximumY = workArea.y + Math.max(0, workArea.height - targetHeight);
    const targetY = Math.max(workArea.y, Math.min(bounds.y, maximumY));

    floatingControlsCollapsed = false;
    floatingWindow.setBounds({ ...bounds, y: targetY, height: targetHeight });
    floatingWindow.setMinimumSize(FLOATING_MIN_WIDTH, FLOATING_EXPANDED_MIN_HEIGHT);
  }

  keepFloatingWindowOnTop();
  sendFloatingControlsState();
  return floatingControlsState();
}

function pythonExecutable() {
  return process.env.PYTHON_EXE || process.env.PYTHON || 'python';
}

function sendBrowserVideoEvent(eventName, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(`browser-video:${eventName}`, payload);
}

function respondJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

function startBrowserBridgeServer() {
  if (browserBridgeServer) {
    return;
  }
  browserBridgeServer = http.createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      respondJson(response, 204, {});
      return;
    }
    if (request.method !== 'POST' || request.url !== '/browser-video-event') {
      respondJson(response, 404, { ok: false, error: 'not_found' });
      return;
    }

    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8192) {
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (payload.event !== 'play' && payload.event !== 'pause' && payload.event !== 'progress' && payload.event !== 'seek-start' && payload.event !== 'seek') {
          respondJson(response, 400, { ok: false, error: 'invalid_event' });
          return;
        }
        if (payload.event === 'progress' && !Number.isFinite(Number(payload.currentTime))) {
          respondJson(response, 400, { ok: false, error: 'invalid_progress_time' });
          return;
        }
        if (payload.event === 'seek-start' && (payload.seekId === null || payload.seekId === undefined || !Number.isFinite(Number(payload.seekId)) || !Number.isFinite(Number(payload.fromTime)))) {
          respondJson(response, 400, { ok: false, error: 'invalid_seek_start' });
          return;
        }
        if (payload.event === 'seek' && !Number.isFinite(Number(payload.deltaSeconds))) {
          respondJson(response, 400, { ok: false, error: 'invalid_seek_delta' });
          return;
        }
        const browserPayload = {
          currentTime: Number.isFinite(Number(payload.currentTime)) ? Number(payload.currentTime) : null,
          duration: Number.isFinite(Number(payload.duration)) ? Number(payload.duration) : null,
          href: typeof payload.href === 'string' ? payload.href : '',
          title: typeof payload.title === 'string' ? payload.title : '',
          timestamp: Number.isFinite(Number(payload.timestamp)) ? Number(payload.timestamp) : Date.now()
        };
        if (payload.event === 'seek-start') {
          browserPayload.seekId = Number(payload.seekId);
          browserPayload.fromTime = Number(payload.fromTime);
          browserPayload.wasPlaying = Boolean(payload.wasPlaying);
        }
        if (payload.event === 'seek') {
          browserPayload.deltaSeconds = Number(payload.deltaSeconds);
          browserPayload.fromTime = Number.isFinite(Number(payload.fromTime)) ? Number(payload.fromTime) : null;
          browserPayload.toTime = Number.isFinite(Number(payload.toTime)) ? Number(payload.toTime) : null;
          browserPayload.seekId = payload.seekId !== null
            && payload.seekId !== undefined
            && Number.isFinite(Number(payload.seekId))
            ? Number(payload.seekId)
            : null;
          browserPayload.playingAfterSeek = typeof payload.playingAfterSeek === 'boolean'
            ? payload.playingAfterSeek
            : null;
        }
        sendBrowserVideoEvent(payload.event, browserPayload);
        respondJson(response, 200, { ok: true });
      } catch (error) {
        respondJson(response, 400, { ok: false, error: 'invalid_json' });
      }
    });
    request.on('error', (error) => {
      debugLog(`browser bridge request error: ${error.message}`);
    });
  });
  browserBridgeServer.on('error', (error) => {
    debugLog(`browser bridge server error: ${error.message}`);
  });
  browserBridgeServer.listen(BROWSER_BRIDGE_PORT, BROWSER_BRIDGE_HOST, () => {
    debugLog(`browser bridge listening on ${BROWSER_BRIDGE_HOST}:${BROWSER_BRIDGE_PORT}`);
  });
}

function parseSubtitle(filePath) {
  return new Promise((resolve) => {
    const child = spawn(
      pythonExecutable(),
      ['-m', 'subtitle_sync.electron_bridge', 'parse', filePath],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          PYTHONPATH: path.join(ROOT, 'src'),
          PYTHONIOENCODING: 'utf-8'
        },
        windowsHide: true
      }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      resolve({ ok: false, error: error.message });
    });
    child.on('close', () => {
      try {
        const payload = JSON.parse(stdout.trim() || '{}');
        if (payload && typeof payload === 'object' && 'ok' in payload) {
          resolve(payload);
          return;
        }
      } catch {
        // Fall through to a formatted error.
      }
      resolve({ ok: false, error: stderr.trim() || '字幕解析失败。' });
    });
  });
}

function createMainWindow() {
  config = loadConfig();
  mainWindow = new BrowserWindow({
    x: Number(config.main_window_x),
    y: Number(config.main_window_y),
    width: Number(config.main_window_width),
    height: COMPACT_MAIN_HEIGHT,
    minWidth: 340,
    minHeight: COMPACT_MAIN_HEIGHT,
    frame: false,
    resizable: false,
    alwaysOnTop: Boolean(config.always_on_top),
    title: 'SubtitleSync',
    backgroundColor: '#101418',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', () => {
    if (!mainWindow) {
      return;
    }
    const bounds = mainWindow.getBounds();
    saveConfig({
      main_window_x: bounds.x,
      main_window_y: bounds.y,
      main_window_width: bounds.width,
      main_window_height: bounds.height
    });
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (floatingWindow) {
      floatingWindow.close();
    }
  });
}

function createFloatingWindow() {
  floatingControlsCollapsed = false;
  floatingControlsHeightDelta = DEFAULT_FLOATING_CONTROLS_HEIGHT_DELTA;
  clearFloatingResizeSession();
  floatingWindow = new BrowserWindow({
    x: Number(config.floating_x),
    y: Number(config.floating_y),
    width: Number(config.floating_width),
    height: Number(config.floating_height),
    minWidth: FLOATING_MIN_WIDTH,
    minHeight: FLOATING_EXPANDED_MIN_HEIGHT,
    frame: false,
    thickFrame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    title: 'SubtitleSync Floating',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  floatingWindow.setMenuBarVisibility(false);
  keepFloatingWindowOnTop();
  floatingWindow.loadFile(path.join(__dirname, 'renderer', 'floating.html'));

  const persistBounds = () => {
    if (!floatingWindow) {
      return;
    }
    const bounds = floatingWindow.getBounds();
    saveConfig({
      floating_x: bounds.x,
      floating_y: bounds.y,
      floating_width: bounds.width,
      floating_height: floatingControlsCollapsed
        ? Math.max(
          FLOATING_EXPANDED_MIN_HEIGHT,
          bounds.height + floatingControlsHeightDelta
        )
        : bounds.height
    });
  };
  floatingWindow.on('move', persistBounds);
  floatingWindow.on('resize', persistBounds);
  floatingWindow.on('show', keepFloatingWindowOnTop);
  floatingWindow.on('focus', keepFloatingWindowOnTop);
  floatingWindow.on('blur', keepFloatingWindowOnTop);
  floatingWindow.on('closed', () => {
    clearFloatingResizeSession();
    floatingWindow = null;
    floatingControlsCollapsed = false;
    floatingControlsHeightDelta = DEFAULT_FLOATING_CONTROLS_HEIGHT_DELTA;
  });
}

ipcMain.handle('config:load', () => {
  config = loadConfig();
  return config;
});

ipcMain.handle('config:save', (_event, partial) => {
  const saved = saveConfig(partial || {});
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('config:updated', saved);
    keepFloatingWindowOnTop();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(Boolean(saved.always_on_top));
  }
  return saved;
});

ipcMain.handle('window:toggle-always-on-top', () => {
  const pinned = !Boolean(config.always_on_top);
  const saved = saveConfig({ always_on_top: pinned });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(pinned);
  }
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    keepFloatingWindowOnTop();
  }
  return Boolean(saved.always_on_top);
});

ipcMain.handle('window:minimize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  mainWindow.minimize();
  return true;
});

ipcMain.handle('window:close', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  mainWindow.close();
  return true;
});

ipcMain.handle('subtitle:select', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择字幕文件',
    properties: ['openFile'],
    filters: [
      { name: '字幕文件', extensions: ['srt', 'ass', 'ssa'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }
  return parseSubtitle(result.filePaths[0]);
});

ipcMain.handle('window:resize-main', (_event, loaded) => {
  if (!mainWindow) {
    return false;
  }
  mainWindow.setResizable(true);
  const bounds = mainWindow.getBounds();
  mainWindow.setBounds({
    ...bounds,
    width: Number(config.main_window_width) || 420,
    height: loaded ? LOADED_MAIN_HEIGHT : COMPACT_MAIN_HEIGHT
  });
  mainWindow.setResizable(false);
  return true;
});

ipcMain.handle('floating:show', () => {
  if (!floatingWindow) {
    createFloatingWindow();
  }
  setFloatingControlsCollapsed(false);
  keepFloatingWindowOnTop();
  floatingWindow.showInactive();
  return true;
});

ipcMain.handle('floating:hide', () => {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    return false;
  }
  clearFloatingResizeSession();
  floatingWindow.hide();
  return true;
});

ipcMain.on('floating:resize-begin', (event, edge) => {
  if (
    !floatingWindow
    || floatingWindow.isDestroyed()
    || event.sender !== floatingWindow.webContents
    || !isResizeEdge(edge)
  ) {
    return;
  }
  floatingResizeSession = {
    edge,
    startBounds: floatingWindow.getBounds(),
    startPoint: screen.getCursorScreenPoint()
  };
  keepFloatingWindowOnTop();
});

ipcMain.on('floating:resize-update', (event) => {
  if (
    !floatingResizeSession
    || !floatingWindow
    || floatingWindow.isDestroyed()
    || event.sender !== floatingWindow.webContents
  ) {
    return;
  }
  const currentPoint = screen.getCursorScreenPoint();
  const minHeight = floatingControlsCollapsed
    ? FLOATING_COLLAPSED_MIN_HEIGHT
    : FLOATING_EXPANDED_MIN_HEIGHT;
  floatingWindow.setBounds(resizedBounds(
    floatingResizeSession.startBounds,
    currentPoint.x - floatingResizeSession.startPoint.x,
    currentPoint.y - floatingResizeSession.startPoint.y,
    floatingResizeSession.edge,
    FLOATING_MIN_WIDTH,
    minHeight
  ));
});

ipcMain.on('floating:resize-end', (event) => {
  if (
    floatingWindow
    && !floatingWindow.isDestroyed()
    && event.sender === floatingWindow.webContents
  ) {
    clearFloatingResizeSession();
  }
});

ipcMain.handle('floating:set-controls-collapsed', (event, payload = {}) => {
  if (
    !floatingWindow
    || floatingWindow.isDestroyed()
    || event.sender !== floatingWindow.webContents
  ) {
    return floatingControlsState();
  }
  return setFloatingControlsCollapsed(payload.collapsed, payload.heightDelta);
});

ipcMain.on('floating:update-subtitle', (_event, text) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('floating:subtitle', String(text || ''));
  }
});

ipcMain.on('floating:set-playing', (_event, playing) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('floating:playing', Boolean(playing));
  }
});

ipcMain.on('floating:preview-config', (_event, partial) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('config:updated', sanitizeConfig({ ...config, ...(partial || {}) }));
  }
});

ipcMain.on('floating:previous', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('control:previous');
  }
});

ipcMain.on('floating:toggle-play-pause', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('control:play-pause');
  }
});

ipcMain.on('floating:next', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('control:next');
  }
});

ipcMain.on('floating:adjust-playback', (_event, deltaMs) => {
  const adjustment = Number(deltaMs);
  if ((adjustment !== -500 && adjustment !== 500) || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('control:adjust-playback', adjustment);
});

ipcMain.on('floating:save-bounds', (_event, bounds) => {
  saveConfig(bounds || {});
});

app.whenReady().then(() => {
  debugLog('app ready');
  startBrowserBridgeServer();
  createMainWindow();
  debugLog('main window created');
  createFloatingWindow();
  debugLog('floating window created');
  if (process.env.SUBTITLE_SYNC_SMOKE === '1') {
    if (!hasNoActivateStyle(floatingWindow)) {
      console.error('floating-no-activate-style-missing');
      app.exit(1);
      return;
    }
    setTimeout(() => {
      console.log('electron-start-ok');
      app.quit();
    }, 1000);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createFloatingWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (browserBridgeServer) {
    browserBridgeServer.close();
    browserBridgeServer = null;
  }
});

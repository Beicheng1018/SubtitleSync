const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('subtitleSync', {
  selectSubtitleFile: () => ipcRenderer.invoke('subtitle:select'),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (partialConfig) => ipcRenderer.invoke('config:save', partialConfig),
  toggleMainAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-always-on-top'),
  minimizeMainWindow: () => ipcRenderer.invoke('window:minimize'),
  closeMainWindow: () => ipcRenderer.invoke('window:close'),
  showFloating: (options = {}) => ipcRenderer.invoke('floating:show', options),
  hideFloating: () => ipcRenderer.invoke('floating:hide'),
  setFloatingControlsCollapsed: (collapsed, heightDelta) => ipcRenderer.invoke(
    'floating:set-controls-collapsed',
    { collapsed, heightDelta }
  ),
  beginFloatingResize: (edge) => ipcRenderer.send('floating:resize-begin', edge),
  updateFloatingResize: () => ipcRenderer.send('floating:resize-update'),
  endFloatingResize: () => ipcRenderer.send('floating:resize-end'),
  updateFloatingSubtitle: (text) => ipcRenderer.send('floating:update-subtitle', text),
  setFloatingPlaying: (playing) => ipcRenderer.send('floating:set-playing', playing),
  previewFloatingConfig: (partialConfig) => ipcRenderer.send('floating:preview-config', partialConfig),
  resizeMainWindow: (loaded) => ipcRenderer.invoke('window:resize-main', loaded),
  onPreviousRequested: (callback) => ipcRenderer.on('control:previous', callback),
  onPlayPauseRequested: (callback) => ipcRenderer.on('control:play-pause', callback),
  onNextRequested: (callback) => ipcRenderer.on('control:next', callback),
  onAdjustPlaybackRequested: (callback) => ipcRenderer.on('control:adjust-playback', (_event, deltaMs) => callback(deltaMs)),
  onBrowserVideoPlay: (callback) => ipcRenderer.on('browser-video:play', (_event, payload) => callback(payload)),
  onBrowserVideoPause: (callback) => ipcRenderer.on('browser-video:pause', (_event, payload) => callback(payload)),
  onBrowserVideoProgress: (callback) => ipcRenderer.on('browser-video:progress', (_event, payload) => callback(payload)),
  onBrowserVideoSeekStart: (callback) => ipcRenderer.on('browser-video:seek-start', (_event, payload) => callback(payload)),
  onBrowserVideoSeek: (callback) => ipcRenderer.on('browser-video:seek', (_event, payload) => callback(payload)),
  previous: () => ipcRenderer.send('floating:previous'),
  togglePlayPause: () => ipcRenderer.send('floating:toggle-play-pause'),
  next: () => ipcRenderer.send('floating:next'),
  adjustPlayback: (deltaMs) => ipcRenderer.send('floating:adjust-playback', deltaMs),
  saveFloatingBounds: (bounds) => ipcRenderer.send('floating:save-bounds', bounds),
  onFloatingSubtitle: (callback) => ipcRenderer.on('floating:subtitle', (_event, text) => callback(text)),
  onFloatingPlaying: (callback) => ipcRenderer.on('floating:playing', (_event, playing) => callback(playing)),
  onFloatingControlsCollapsed: (callback) => ipcRenderer.on(
    'floating:controls-collapsed',
    (_event, state) => callback(state)
  ),
  onConfigUpdated: (callback) => ipcRenderer.on('config:updated', (_event, config) => callback(config))
});

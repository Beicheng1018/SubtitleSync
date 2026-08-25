const api = window.subtitleSync;

const state = {
  config: null,
  cues: [],
  currentPosition: -1,
  playing: false,
  pausedPlaybackMs: 0,
  playAnchorMs: 0,
  playAnchorTime: 0,
  timerId: null,
  settingsSaveTimer: null,
  browserSeek: null,
  subtitleOffsetMs: null,
  fileNameAnimation: null,
  fileNameAnimationFrame: null,
  fileNamePaused: false,
  fileNameResizeObserver: null,
  loadedFileName: ''
};

const BROWSER_PROGRESS_CORRECTION_THRESHOLD_MS = 120;
const FILE_NAME_START_DELAY_MS = 3000;
const FILE_NAME_END_DELAY_MS = 5000;
const FILE_NAME_SCROLL_SPEED_PX_PER_SECOND = 30;

const pinBtn = document.getElementById('pinBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');
const emptyState = document.getElementById('emptyState');
const loadedState = document.getElementById('loadedState');
const uploadBtn = document.getElementById('uploadBtn');
const removeSubtitleBtn = document.getElementById('removeSubtitleBtn');
const reselectBtn = document.getElementById('reselectBtn');
const settingsBtn = document.getElementById('settingsBtn');
const fileNameViewport = document.getElementById('fileNameViewport');
const fileNameScroller = document.getElementById('fileNameScroller');
const fileExtension = document.getElementById('fileExtension');
const subtitleList = document.getElementById('subtitleList');
const settingsDialog = document.getElementById('settingsDialog');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const fontSizeInput = document.getElementById('fontSizeInput');
const opacityInput = document.getElementById('opacityInput');
const opacityOutput = document.getElementById('opacityOutput');
const minimizeToTrayInput = document.getElementById('minimizeToTrayInput');
const settingsStatus = document.getElementById('settingsStatus');

function formatTimestamp(ms) {
  const safeMs = Math.max(0, Math.floor(Number(ms) || 0));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function setLoadedState(loaded) {
  emptyState.classList.toggle('hidden', loaded);
  loadedState.classList.toggle('hidden', !loaded);
  api.resizeMainWindow(loaded);
}

function syncPinButton(pinned) {
  pinBtn.classList.toggle('active', Boolean(pinned));
  pinBtn.setAttribute('aria-pressed', String(Boolean(pinned)));
  pinBtn.title = pinned ? '取消置顶' : '置顶';
  pinBtn.setAttribute('aria-label', pinBtn.title);
}

function splitSubtitleFileName(fileName) {
  const match = /^(.*)(\.(?:srt|ass|ssa))$/i.exec(fileName);
  if (!match) {
    return { stem: fileName, extension: '' };
  }
  return { stem: match[1], extension: match[2] };
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function cancelFileNameAnimation() {
  if (state.fileNameAnimationFrame !== null) {
    cancelAnimationFrame(state.fileNameAnimationFrame);
    state.fileNameAnimationFrame = null;
  }
  if (state.fileNameAnimation) {
    state.fileNameAnimation.cancel();
    state.fileNameAnimation = null;
  }
  fileNameScroller.style.transform = '';
  fileNameViewport.removeAttribute('title');
}

function updateFileNameAnimation() {
  cancelFileNameAnimation();
  if (!state.loadedFileName || fileNameViewport.clientWidth <= 0) {
    return;
  }

  const overflowPx = Math.ceil(fileNameScroller.scrollWidth - fileNameViewport.clientWidth);
  if (overflowPx <= 1) {
    return;
  }

  fileNameViewport.title = state.loadedFileName;
  if (prefersReducedMotion()) {
    return;
  }

  const travelMs = (overflowPx / FILE_NAME_SCROLL_SPEED_PX_PER_SECOND) * 1000;
  const duration = FILE_NAME_START_DELAY_MS + travelMs + FILE_NAME_END_DELAY_MS + travelMs;
  const moveToEndOffset = (FILE_NAME_START_DELAY_MS + travelMs) / duration;
  const moveToStartOffset = (FILE_NAME_START_DELAY_MS + travelMs + FILE_NAME_END_DELAY_MS) / duration;
  state.fileNameAnimation = fileNameScroller.animate(
    [
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(0)', offset: FILE_NAME_START_DELAY_MS / duration },
      { transform: `translateX(-${overflowPx}px)`, offset: moveToEndOffset },
      { transform: `translateX(-${overflowPx}px)`, offset: moveToStartOffset },
      { transform: 'translateX(0)', offset: 1 }
    ],
    {
      duration,
      easing: 'linear',
      iterations: Infinity
    }
  );
  if (state.fileNamePaused) {
    state.fileNameAnimation.pause();
  }
}

function scheduleFileNameAnimationUpdate() {
  if (state.fileNameAnimationFrame !== null) {
    cancelAnimationFrame(state.fileNameAnimationFrame);
  }
  state.fileNameAnimationFrame = requestAnimationFrame(() => {
    state.fileNameAnimationFrame = null;
    updateFileNameAnimation();
  });
}

function setFileNameDisplay(fileName) {
  cancelFileNameAnimation();
  state.loadedFileName = fileName || '';
  const { stem, extension } = splitSubtitleFileName(state.loadedFileName);
  fileNameScroller.textContent = stem;
  fileExtension.textContent = extension;
  scheduleFileNameAnimationUpdate();
}

function clearFileNameDisplay() {
  cancelFileNameAnimation();
  state.loadedFileName = '';
  fileNameScroller.textContent = '';
  fileExtension.textContent = '';
}

function pauseFileNameAnimation() {
  state.fileNamePaused = true;
  state.fileNameAnimation?.pause();
}

function resumeFileNameAnimation() {
  state.fileNamePaused = false;
  state.fileNameAnimation?.play();
}

function cleanupFileNameAnimation() {
  cancelFileNameAnimation();
  state.fileNameResizeObserver?.disconnect();
  state.fileNameResizeObserver = null;
}

function renderSubtitleList() {
  subtitleList.replaceChildren();
  state.cues.forEach((cue, position) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'subtitle-item';
    item.dataset.position = String(position);

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = `${formatTimestamp(cue.start_ms)} - ${formatTimestamp(cue.end_ms)}`;

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = cue.text;

    item.append(time, text);
    item.addEventListener('click', () => selectPosition(position, true));
    subtitleList.append(item);
  });
}

function cuePositionAtTime(playbackMs) {
  if (state.cues.length === 0) {
    return 0;
  }
  let position = Math.min(Math.max(state.currentPosition, 0), state.cues.length - 1);
  while (position + 1 < state.cues.length && playbackMs >= state.cues[position + 1].start_ms) {
    position += 1;
  }
  while (position > 0 && playbackMs < state.cues[position].start_ms) {
    position -= 1;
  }
  return position;
}

function visibleCuesAtTime(playbackMs) {
  if (state.cues.length === 0) {
    return [];
  }
  let positions = [];
  state.cues.forEach((cue, position) => {
    if (cue.start_ms <= playbackMs && playbackMs <= cue.end_ms) {
      positions.push(position);
    }
  });
  if (positions.length === 0) {
    positions = [cuePositionAtTime(playbackMs)];
  }
  const maxVisible = Math.max(1, Number(state.config?.subtitle_display_max_lines) || 2);
  return [...new Set(positions)].sort((a, b) => a - b).slice(-maxVisible).map((position) => state.cues[position]);
}

function formatVisibleCues(cues) {
  const seen = new Set();
  return [...cues]
    .sort((a, b) => a.start_ms - b.start_ms || a.index - b.index)
    .filter((cue) => {
      if (seen.has(cue.index)) {
        return false;
      }
      seen.add(cue.index);
      return true;
    })
    .map((cue) => cue.text)
    .join('\n');
}

function updateSelection(scroll) {
  const items = [...subtitleList.querySelectorAll('.subtitle-item')];
  items.forEach((item, index) => {
    item.classList.toggle('active', index === state.currentPosition);
  });
  if (scroll && state.currentPosition >= 0 && items[state.currentPosition]) {
    items[state.currentPosition].scrollIntoView({ block: 'center' });
  }
}

function updateFloatingForTime(playbackMs) {
  const visible = visibleCuesAtTime(playbackMs);
  if (visible.length > 0) {
    api.updateFloatingSubtitle(formatVisibleCues(visible));
  }
}

function restartAnchorFrom(playbackMs) {
  state.playAnchorMs = Math.max(0, Math.floor(playbackMs));
  state.playAnchorTime = performance.now();
  state.pausedPlaybackMs = state.playAnchorMs;
}

function currentPlaybackMs() {
  if (!state.playing) {
    return state.pausedPlaybackMs;
  }
  return Math.max(0, state.playAnchorMs + Math.floor(performance.now() - state.playAnchorTime));
}

function clampPlaybackMs(playbackMs) {
  const lastCue = state.cues[state.cues.length - 1];
  const maxMs = lastCue ? Number(lastCue.end_ms) || 0 : 0;
  return Math.min(Math.max(0, Math.floor(Number(playbackMs) || 0)), maxMs);
}

function browserVideoTimeMs(payload) {
  const currentTime = Number(payload?.currentTime);
  return Number.isFinite(currentTime) ? currentTime * 1000 : null;
}

function syncPlaybackToBrowser(payload, force) {
  const videoTimeMs = browserVideoTimeMs(payload);
  if (videoTimeMs === null) {
    return currentPlaybackMs();
  }
  const currentSubtitleMs = clampPlaybackMs(currentPlaybackMs());
  if (!Number.isFinite(state.subtitleOffsetMs)) {
    state.subtitleOffsetMs = currentSubtitleMs - videoTimeMs;
    return currentSubtitleMs;
  }
  const targetSubtitleMs = clampPlaybackMs(videoTimeMs + state.subtitleOffsetMs);
  if (force || Math.abs(targetSubtitleMs - currentSubtitleMs) >= BROWSER_PROGRESS_CORRECTION_THRESHOLD_MS) {
    applyPlaybackPosition(targetSubtitleMs, false);
  }
  return targetSubtitleMs;
}

function applyPlaybackPosition(playbackMs, scroll) {
  if (state.cues.length === 0) {
    return;
  }
  const clamped = clampPlaybackMs(playbackMs);
  if (state.playing) {
    restartAnchorFrom(clamped);
  } else {
    state.pausedPlaybackMs = clamped;
  }
  state.currentPosition = cuePositionAtTime(clamped);
  updateSelection(scroll);
  updateFloatingForTime(clamped);
}

function playbackIntervalMs() {
  return Math.max(30, Number(state.config?.timeline_tick_ms) || 100);
}

function ensurePlaybackTimer() {
  if (!state.playing || state.timerId !== null) {
    return;
  }
  state.timerId = setInterval(advancePlayback, playbackIntervalMs());
}

function syncFloatingPlayButton(playing) {
  api.setFloatingPlaying(Boolean(playing));
}

function selectPosition(position, showFloating) {
  if (state.cues.length === 0) {
    return;
  }
  const clamped = Math.min(Math.max(position, 0), state.cues.length - 1);
  const cue = state.cues[clamped];
  state.subtitleOffsetMs = null;
  state.currentPosition = clamped;
  state.pausedPlaybackMs = cue.start_ms;
  updateSelection(true);
  updateFloatingForTime(cue.start_ms);
  if (state.playing) {
    restartAnchorFrom(cue.start_ms);
    ensurePlaybackTimer();
  }
  if (showFloating) {
    api.showFloating();
  }
}

function advancePlayback() {
  const playbackMs = currentPlaybackMs();
  state.pausedPlaybackMs = playbackMs;
  const nextPosition = cuePositionAtTime(playbackMs);
  if (nextPosition !== state.currentPosition) {
    state.currentPosition = nextPosition;
    updateSelection(true);
  }
  updateFloatingForTime(playbackMs);
  if (state.cues.length > 0 && playbackMs > state.cues[state.cues.length - 1].end_ms) {
    pausePlayback();
  }
}

function startPlayback() {
  if (state.cues.length === 0) {
    return;
  }
  if (state.currentPosition < 0) {
    selectPosition(0, true);
  }
  state.playing = true;
  restartAnchorFrom(state.pausedPlaybackMs);
  syncFloatingPlayButton(true);
  clearInterval(state.timerId);
  state.timerId = null;
  ensurePlaybackTimer();
  advancePlayback();
}

function pausePlayback() {
  state.pausedPlaybackMs = currentPlaybackMs();
  state.playing = false;
  clearInterval(state.timerId);
  state.timerId = null;
  syncFloatingPlayButton(false);
}

function togglePlayback() {
  if (state.browserSeek) {
    state.browserSeek.resumePlaying = !state.browserSeek.resumePlaying;
    syncFloatingPlayButton(state.browserSeek.resumePlaying);
    return;
  }
  if (state.playing) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function handleBrowserVideoPlay(payload) {
  if (state.browserSeek) {
    state.browserSeek.resumePlaying = true;
    return;
  }
  syncFloatingPlayButton(true);
  if (state.cues.length === 0 || state.currentPosition < 0) {
    return;
  }
  syncPlaybackToBrowser(payload, true);
  if (!state.playing) {
    startPlayback();
  } else {
    ensurePlaybackTimer();
    syncFloatingPlayButton(true);
  }
}

function handleBrowserVideoPause(payload) {
  if (state.browserSeek) {
    state.browserSeek.resumePlaying = false;
    return;
  }
  syncFloatingPlayButton(false);
  if (state.cues.length === 0 || state.currentPosition < 0) {
    pausePlayback();
    return;
  }
  syncPlaybackToBrowser(payload, true);
  if (state.playing) {
    pausePlayback();
  } else {
    state.pausedPlaybackMs = currentPlaybackMs();
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function handleBrowserVideoProgress(payload) {
  if (state.browserSeek || !state.playing || state.cues.length === 0 || state.currentPosition < 0) {
    return;
  }
  syncPlaybackToBrowser(payload, false);
}

function handleBrowserVideoSeekStart(payload) {
  if (state.cues.length === 0 || state.currentPosition < 0) {
    return;
  }
  const rawSeekId = payload?.seekId;
  const seekId = rawSeekId !== null && rawSeekId !== undefined ? Number(rawSeekId) : NaN;
  if (!Number.isFinite(seekId)) {
    return;
  }
  if (state.browserSeek?.seekId === seekId) {
    return;
  }
  const frozenPlaybackMs = currentPlaybackMs();
  const resumePlaying = typeof payload?.wasPlaying === 'boolean'
    ? payload.wasPlaying
    : state.playing;
  state.pausedPlaybackMs = frozenPlaybackMs;
  state.playing = false;
  clearInterval(state.timerId);
  state.timerId = null;
  state.browserSeek = {
    seekId,
    frozenPlaybackMs,
    resumePlaying
  };
  const fromTime = Number(payload?.fromTime);
  if (!Number.isFinite(state.subtitleOffsetMs) && Number.isFinite(fromTime)) {
    state.subtitleOffsetMs = frozenPlaybackMs - fromTime * 1000;
  }
}

function handleBrowserVideoSeek(payload) {
  if (state.cues.length === 0 || state.currentPosition < 0) {
    return;
  }
  const deltaSeconds = Number(payload?.deltaSeconds);
  if (!Number.isFinite(deltaSeconds)) {
    return;
  }
  const rawSeekId = payload?.seekId;
  const seekId = rawSeekId !== null && rawSeekId !== undefined ? Number(rawSeekId) : NaN;
  const activeSeek = state.browserSeek;
  if (activeSeek && (!Number.isFinite(seekId) || activeSeek.seekId !== seekId)) {
    return;
  }
  if (!activeSeek && Math.abs(deltaSeconds) < 0.3) {
    return;
  }

  const basePlaybackMs = activeSeek ? activeSeek.frozenPlaybackMs : currentPlaybackMs();
  const resumePlaying = typeof payload?.playingAfterSeek === 'boolean'
    ? payload.playingAfterSeek
    : activeSeek?.resumePlaying ?? state.playing;
  const toTime = Number(payload?.toTime);
  const fromTime = Number(payload?.fromTime);
  if (!Number.isFinite(state.subtitleOffsetMs) && Number.isFinite(fromTime)) {
    state.subtitleOffsetMs = basePlaybackMs - fromTime * 1000;
  }
  const hasAbsoluteSeekTarget = Number.isFinite(toTime) && Number.isFinite(state.subtitleOffsetMs);
  const targetPlaybackMs = hasAbsoluteSeekTarget
    ? toTime * 1000 + state.subtitleOffsetMs
    : basePlaybackMs + deltaSeconds * 1000;
  state.browserSeek = null;
  state.playing = false;
  clearInterval(state.timerId);
  state.timerId = null;
  applyPlaybackPosition(targetPlaybackMs, true);
  if (!hasAbsoluteSeekTarget && Number.isFinite(toTime)) {
    state.subtitleOffsetMs = state.pausedPlaybackMs - toTime * 1000;
  }
  if (resumePlaying) {
    startPlayback();
  } else {
    syncFloatingPlayButton(false);
  }
  api.showFloating({ preserveControlsState: true });
}

function adjustPlaybackBy(deltaMs) {
  if (state.cues.length === 0 || state.currentPosition < 0) {
    return;
  }
  const adjustment = Number(deltaMs);
  if (adjustment !== -500 && adjustment !== 500) {
    return;
  }

  const basePlaybackMs = state.browserSeek
    ? state.browserSeek.frozenPlaybackMs
    : currentPlaybackMs();
  const targetPlaybackMs = clampPlaybackMs(basePlaybackMs + adjustment);
  const effectiveAdjustmentMs = targetPlaybackMs - basePlaybackMs;
  applyPlaybackPosition(targetPlaybackMs, true);

  if (state.browserSeek) {
    state.browserSeek.frozenPlaybackMs = targetPlaybackMs;
  }
  if (Number.isFinite(state.subtitleOffsetMs) && effectiveAdjustmentMs !== 0) {
    state.subtitleOffsetMs += effectiveAdjustmentMs;
  }
  api.showFloating();
}

function movePrevious() {
  const target = state.currentPosition >= 0 ? state.currentPosition - 1 : 0;
  selectPosition(target, true);
}

function moveNext() {
  const target = state.currentPosition >= 0 ? state.currentPosition + 1 : 0;
  selectPosition(target, true);
}

async function loadSubtitle() {
  const payload = await api.selectSubtitleFile();
  if (!payload || payload.canceled) {
    return;
  }
  if (!payload.ok) {
    window.alert(payload.error || '字幕解析失败。');
    return;
  }
  pausePlayback();
  state.browserSeek = null;
  state.subtitleOffsetMs = null;
  state.cues = payload.cues || [];
  state.currentPosition = -1;
  state.pausedPlaybackMs = state.cues.length > 0 ? state.cues[0].start_ms : 0;
  setFileNameDisplay(payload.fileName);
  renderSubtitleList();
  subtitleList.scrollTop = 0;
  setLoadedState(true);
  await api.hideFloating();
}

async function removeSubtitle() {
  pausePlayback();
  state.cues = [];
  state.currentPosition = -1;
  state.pausedPlaybackMs = 0;
  state.playAnchorMs = 0;
  state.playAnchorTime = 0;
  state.browserSeek = null;
  state.subtitleOffsetMs = null;
  clearFileNameDisplay();
  subtitleList.replaceChildren();
  setLoadedState(false);
  await api.hideFloating();
}

function openSettings() {
  fontSizeInput.value = String(state.config.font_size);
  opacityInput.value = String(Math.round(Number(state.config.window_opacity) * 100));
  opacityOutput.textContent = `${opacityInput.value}%`;
  minimizeToTrayInput.checked = Boolean(state.config.minimizeToTrayOnClose);
  settingsStatus.textContent = '调整后会自动保存';
  settingsDialog.showModal();
}

function scheduleSettingsSave() {
  clearTimeout(state.settingsSaveTimer);
  settingsStatus.textContent = '正在保存...';
  state.settingsSaveTimer = setTimeout(async () => {
    state.config = await api.saveConfig({
      font_size: Number(fontSizeInput.value),
      window_opacity: Number(opacityInput.value) / 100,
      minimizeToTrayOnClose: minimizeToTrayInput.checked
    });
    settingsStatus.textContent = '已自动保存';
  }, 180);
}

function handleFontSizeInput() {
  const value = Math.max(12, Math.min(72, Number(fontSizeInput.value) || 12));
  fontSizeInput.value = String(value);
  api.previewFloatingConfig({ font_size: value });
  scheduleSettingsSave();
}

function handleOpacityInput() {
  opacityOutput.textContent = `${opacityInput.value}%`;
  api.previewFloatingConfig({ window_opacity: Number(opacityInput.value) / 100 });
  scheduleSettingsSave();
}

async function init() {
  state.config = await api.loadConfig();
  state.fileNameResizeObserver = new ResizeObserver(scheduleFileNameAnimationUpdate);
  state.fileNameResizeObserver.observe(fileNameViewport);
  syncPinButton(state.config.always_on_top);
  setLoadedState(false);
  pinBtn.addEventListener('click', async () => {
    const pinned = await api.toggleMainAlwaysOnTop();
    state.config.always_on_top = pinned;
    syncPinButton(pinned);
  });
  minimizeBtn.addEventListener('click', () => api.minimizeMainWindow());
  closeBtn.addEventListener('click', () => api.closeMainWindow());
  uploadBtn.addEventListener('click', loadSubtitle);
  removeSubtitleBtn.addEventListener('click', removeSubtitle);
  reselectBtn.addEventListener('click', loadSubtitle);
  settingsBtn.addEventListener('click', openSettings);
  fileNameViewport.addEventListener('mouseenter', pauseFileNameAnimation);
  fileNameViewport.addEventListener('mouseleave', resumeFileNameAnimation);
  window.addEventListener('beforeunload', cleanupFileNameAnimation, { once: true });
  closeSettingsBtn.addEventListener('click', () => settingsDialog.close());
  fontSizeInput.addEventListener('input', handleFontSizeInput);
  fontSizeInput.addEventListener('change', handleFontSizeInput);
  opacityInput.addEventListener('input', handleOpacityInput);
  opacityInput.addEventListener('change', handleOpacityInput);
  minimizeToTrayInput.addEventListener('change', scheduleSettingsSave);
  api.onPreviousRequested(() => movePrevious());
  api.onPlayPauseRequested(() => togglePlayback());
  api.onNextRequested(() => moveNext());
  api.onAdjustPlaybackRequested((deltaMs) => adjustPlaybackBy(deltaMs));
  api.onBrowserVideoPlay((payload) => handleBrowserVideoPlay(payload));
  api.onBrowserVideoPause((payload) => handleBrowserVideoPause(payload));
  api.onBrowserVideoProgress((payload) => handleBrowserVideoProgress(payload));
  api.onBrowserVideoSeekStart((payload) => handleBrowserVideoSeekStart(payload));
  api.onBrowserVideoSeek((payload) => handleBrowserVideoSeek(payload));
}

init();

const api = window.subtitleSync;

const floatingRoot = document.getElementById('floatingRoot');
const subtitleText = document.getElementById('subtitleText');
const floatingControls = document.getElementById('floatingControls');
const controlsToggleBtn = document.getElementById('controlsToggleBtn');
const rewindHalfSecondBtn = document.getElementById('rewindHalfSecondBtn');
const previousBtn = document.getElementById('previousBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const nextBtn = document.getElementById('nextBtn');
const forwardHalfSecondBtn = document.getElementById('forwardHalfSecondBtn');
const resizeHandles = document.querySelectorAll('[data-resize-edge]');

let controlsCollapsed = false;
let controlsHeightDelta = 36;
let controlsTogglePending = false;
let activeResizeHandle = null;
let activeResizePointerId = null;
let resizeUpdateFrame = null;

function queueResizeUpdate() {
  if (resizeUpdateFrame !== null) {
    return;
  }
  resizeUpdateFrame = requestAnimationFrame(() => {
    resizeUpdateFrame = null;
    api.updateFloatingResize();
  });
}

function finishResize(pointerId) {
  if (activeResizeHandle === null || activeResizePointerId !== pointerId) {
    return;
  }
  const handle = activeResizeHandle;
  const capturedPointerId = activeResizePointerId;
  activeResizeHandle = null;
  activeResizePointerId = null;

  if (resizeUpdateFrame !== null) {
    cancelAnimationFrame(resizeUpdateFrame);
    resizeUpdateFrame = null;
    api.updateFloatingResize();
  }
  api.endFloatingResize();
  if (handle.hasPointerCapture(capturedPointerId)) {
    handle.releasePointerCapture(capturedPointerId);
  }
}

function bindResizeHandle(handle) {
  handle.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || activeResizeHandle !== null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    activeResizeHandle = handle;
    activeResizePointerId = event.pointerId;
    handle.setPointerCapture(event.pointerId);
    api.beginFloatingResize(handle.dataset.resizeEdge);
  });
  handle.addEventListener('pointermove', (event) => {
    if (activeResizeHandle === handle && activeResizePointerId === event.pointerId) {
      event.preventDefault();
      queueResizeUpdate();
    }
  });
  handle.addEventListener('pointerup', (event) => finishResize(event.pointerId));
  handle.addEventListener('pointercancel', (event) => finishResize(event.pointerId));
  handle.addEventListener('lostpointercapture', (event) => finishResize(event.pointerId));
}

function measureControlsHeightDelta() {
  const rowGap = Number.parseFloat(getComputedStyle(floatingRoot).rowGap) || 0;
  return Math.ceil(floatingControls.getBoundingClientRect().height + rowGap);
}

function applyControlsCollapsed(state) {
  controlsCollapsed = Boolean(state && state.collapsed);
  const reportedHeightDelta = Number(state && state.heightDelta);
  if (Number.isFinite(reportedHeightDelta) && reportedHeightDelta > 0) {
    controlsHeightDelta = reportedHeightDelta;
  }

  floatingRoot.classList.toggle('controls-collapsed', controlsCollapsed);
  floatingControls.setAttribute('aria-hidden', String(controlsCollapsed));
  controlsToggleBtn.title = controlsCollapsed ? '展开控制按钮' : '折叠控制按钮';
  controlsToggleBtn.setAttribute(
    'aria-label',
    controlsCollapsed ? '展开控制按钮' : '折叠控制按钮'
  );
  controlsToggleBtn.setAttribute('aria-expanded', String(!controlsCollapsed));
}

async function toggleControls() {
  if (controlsTogglePending) {
    return;
  }
  const nextCollapsed = !controlsCollapsed;
  const requestedHeightDelta = nextCollapsed
    ? measureControlsHeightDelta()
    : controlsHeightDelta;

  controlsTogglePending = true;
  controlsToggleBtn.disabled = true;
  try {
    const state = await api.setFloatingControlsCollapsed(
      nextCollapsed,
      requestedHeightDelta
    );
    applyControlsCollapsed(state);
  } catch (error) {
    console.error('切换控制栏失败：', error);
  } finally {
    controlsTogglePending = false;
    controlsToggleBtn.disabled = false;
  }
}

function applyConfig(config) {
  const configuredOpacity = Number(config.window_opacity);
  const backgroundOpacity = Math.max(
    0,
    Math.min(1, Number.isFinite(configuredOpacity) ? configuredOpacity : 0.82)
  );
  const fontSize = Math.max(12, Number(config.font_size) || 34);
  const highlightAlpha = backgroundOpacity * 0.12;
  const borderAlpha = backgroundOpacity * 0.32;
  const blurPixels = Math.round(backgroundOpacity * 16);
  const saturation = 1 + backgroundOpacity * 0.45;
  const filterValue = backgroundOpacity <= 0.001
    ? 'none'
    : `blur(${blurPixels}px) saturate(${saturation})`;
  document.documentElement.style.setProperty('--subtitle-font-size', `${fontSize}px`);
  document.documentElement.style.setProperty('--glass-alpha', String(backgroundOpacity));
  document.documentElement.style.setProperty('--glass-blur', '16px');
  document.documentElement.style.setProperty('--glass-highlight-alpha', String(highlightAlpha));
  document.documentElement.style.setProperty('--glass-border-alpha', String(borderAlpha));
  floatingRoot.style.background = backgroundOpacity <= 0.001
    ? 'transparent'
    : `rgba(0, 0, 0, ${backgroundOpacity})`;
  floatingRoot.style.backdropFilter = filterValue;
  floatingRoot.style.webkitBackdropFilter = filterValue;
  floatingRoot.style.borderColor = backgroundOpacity <= 0.001
    ? 'transparent'
    : `rgba(255, 255, 255, ${borderAlpha})`;
  floatingRoot.style.boxShadow = backgroundOpacity <= 0.001
    ? 'none'
    : `inset 0 1px 0 rgba(255, 255, 255, ${highlightAlpha})`;
  subtitleText.style.color = '#ffffff';
}

async function init() {
  applyControlsCollapsed({ collapsed: false, heightDelta: controlsHeightDelta });
  applyConfig(await api.loadConfig());
  rewindHalfSecondBtn.addEventListener('click', () => api.adjustPlayback(-500));
  previousBtn.addEventListener('click', () => api.previous());
  playPauseBtn.addEventListener('click', () => api.togglePlayPause());
  nextBtn.addEventListener('click', () => api.next());
  forwardHalfSecondBtn.addEventListener('click', () => api.adjustPlayback(500));
  controlsToggleBtn.addEventListener('click', toggleControls);
  resizeHandles.forEach(bindResizeHandle);

  api.onFloatingSubtitle((text) => {
    subtitleText.textContent = text || '字幕将在这里显示';
  });
  api.onFloatingPlaying((playing) => {
    playPauseBtn.textContent = playing ? '暂停' : '开始';
  });
  api.onFloatingControlsCollapsed((state) => {
    applyControlsCollapsed(state);
  });
  api.onConfigUpdated((config) => {
    applyConfig(config);
  });
}

init();

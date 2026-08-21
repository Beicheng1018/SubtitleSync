(() => {
  if (window.__subtitleSyncVideoBridgeInstalled) {
    return;
  }
  window.__subtitleSyncVideoBridgeInstalled = true;

  const SEEK_THRESHOLD_SECONDS = 0.3;
  const TIMEUPDATE_JUMP_THRESHOLD_SECONDS = 1.0;
  const SEEK_SEND_DEBOUNCE_MS = 150;
  const TIMEUPDATE_AFTER_SEEK_SUPPRESSION_MS = 500;
  const PROGRESS_SEND_INTERVAL_MS = 250;
  const videoState = new WeakMap();
  let lastSignature = '';
  let lastSentAt = 0;
  let nextSeekId = 1;

  function finiteNumber(value) {
    return Number.isFinite(value) ? value : null;
  }

  function stateFor(video) {
    let state = videoState.get(video);
    if (!state) {
      state = {
        lastStableTime: finiteNumber(video.currentTime) || 0,
        seekFrom: null,
        seekId: null,
        wasPlayingBeforeSeek: false,
        lastSeekSentAt: 0,
        lastProgressSentAt: 0,
        suppressTimeupdateUntil: 0
      };
      videoState.set(video, state);
    }
    return state;
  }

  function sendVideoEvent(event, video, extra = {}) {
    const now = Date.now();
    const signature = `${event}:${extra.seekId || 0}:${Math.round(Number(video.currentTime || 0) * 10)}:${Math.round(Number(extra.deltaSeconds || 0) * 10)}`;
    if (signature === lastSignature && now - lastSentAt < 150) {
      return;
    }
    lastSignature = signature;
    lastSentAt = now;

    chrome.runtime.sendMessage({
      type: 'subtitle-sync-video-event',
      payload: {
        event,
        href: window.location.href,
        title: document.title,
        currentTime: finiteNumber(video.currentTime),
        duration: finiteNumber(video.duration),
        timestamp: now,
        ...extra
      }
    });
  }

  function sendSeekEvent(video, fromTime, toTime, extra = {}) {
    const deltaSeconds = toTime - fromTime;
    const explicitSeek = extra.seekId !== null
      && extra.seekId !== undefined
      && Number.isFinite(Number(extra.seekId));
    if (!explicitSeek && Math.abs(deltaSeconds) < SEEK_THRESHOLD_SECONDS) {
      return false;
    }
    const state = stateFor(video);
    const now = Date.now();
    if (!explicitSeek && now - state.lastSeekSentAt < SEEK_SEND_DEBOUNCE_MS) {
      return false;
    }
    state.lastSeekSentAt = now;
    sendVideoEvent('seek', video, {
      fromTime,
      toTime,
      deltaSeconds,
      ...extra
    });
    return true;
  }

  document.addEventListener(
    'play',
    (event) => {
      if (event.target instanceof HTMLVideoElement) {
        sendVideoEvent('play', event.target);
      }
    },
    true
  );

  document.addEventListener(
    'pause',
    (event) => {
      if (event.target instanceof HTMLVideoElement) {
        sendVideoEvent('pause', event.target);
      }
    },
    true
  );

  document.addEventListener(
    'timeupdate',
    (event) => {
      if (!(event.target instanceof HTMLVideoElement) || event.target.seeking) {
        return;
      }
      const video = event.target;
      const state = stateFor(video);
      const currentTime = finiteNumber(video.currentTime);
      if (currentTime === null) {
        return;
      }
      if (Date.now() < state.suppressTimeupdateUntil) {
        state.lastStableTime = currentTime;
        return;
      }
      const deltaSeconds = currentTime - state.lastStableTime;
      if (Math.abs(deltaSeconds) >= TIMEUPDATE_JUMP_THRESHOLD_SECONDS) {
        sendSeekEvent(video, state.lastStableTime, currentTime);
        state.lastStableTime = currentTime;
        return;
      }
      const now = Date.now();
      if (now - state.lastProgressSentAt >= PROGRESS_SEND_INTERVAL_MS) {
        state.lastProgressSentAt = now;
        sendVideoEvent('progress', video);
      }
      state.lastStableTime = currentTime;
    },
    true
  );

  document.addEventListener(
    'seeking',
    (event) => {
      if (event.target instanceof HTMLVideoElement) {
        const video = event.target;
        const state = stateFor(video);
        if (state.seekId !== null) {
          return;
        }
        state.seekId = nextSeekId;
        nextSeekId += 1;
        state.seekFrom = state.lastStableTime;
        state.wasPlayingBeforeSeek = !video.paused && !video.ended;
        sendVideoEvent('seek-start', video, {
          seekId: state.seekId,
          fromTime: state.seekFrom,
          wasPlaying: state.wasPlayingBeforeSeek
        });
      }
    },
    true
  );

  document.addEventListener(
    'seeked',
    (event) => {
      if (!(event.target instanceof HTMLVideoElement)) {
        return;
      }
      const video = event.target;
      const state = stateFor(video);
      const fromTime = finiteNumber(state.seekFrom);
      const toTime = finiteNumber(video.currentTime);
      const seekId = state.seekId;
      const wasPlaying = state.wasPlayingBeforeSeek;
      state.seekFrom = null;
      state.seekId = null;
      state.wasPlayingBeforeSeek = false;
      if (fromTime === null || toTime === null) {
        return;
      }
      state.lastStableTime = toTime;
      state.suppressTimeupdateUntil = Date.now() + TIMEUPDATE_AFTER_SEEK_SUPPRESSION_MS;
      sendSeekEvent(video, fromTime, toTime, {
        seekId,
        wasPlaying,
        playingAfterSeek: !video.paused && !video.ended
      });
    },
    true
  );
})();

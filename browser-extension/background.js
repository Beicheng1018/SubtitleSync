const BRIDGE_URL = 'http://127.0.0.1:37655/browser-video-event';
let sendQueue = Promise.resolve();

function isVideoPayload(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (value.event === 'play' || value.event === 'pause') {
    return true;
  }
  if (value.event === 'progress') {
    return Number.isFinite(Number(value.currentTime));
  }
  if (value.event === 'seek-start') {
    return value.seekId !== null
      && value.seekId !== undefined
      && Number.isFinite(Number(value.seekId))
      && Number.isFinite(Number(value.fromTime));
  }
  return value.event === 'seek' && Number.isFinite(Number(value.deltaSeconds));
}

function enqueueVideoPayload(payload) {
  sendQueue = sendQueue
    .catch(() => {})
    .then(() => fetch(BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }))
    .catch(() => {
      // SubtitleSync may not be running; ignore and retry on the next video event.
    });
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'subtitle-sync-video-event' || !isVideoPayload(message.payload)) {
    return false;
  }

  enqueueVideoPayload(message.payload);

  return false;
});

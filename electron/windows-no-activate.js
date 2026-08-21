const WS_EX_NOACTIVATE = 0x08000000n;
const GWL_EXSTYLE = -20;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;

let windowsApi = null;

function loadWindowsApi() {
  if (process.platform !== 'win32') {
    return null;
  }
  if (windowsApi) {
    return windowsApi;
  }

  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const getWindowLongName = process.arch === 'ia32' ? 'GetWindowLongW' : 'GetWindowLongPtrW';
  const setWindowLongName = process.arch === 'ia32' ? 'SetWindowLongW' : 'SetWindowLongPtrW';
  const longPtrType = process.arch === 'ia32' ? 'long' : 'intptr_t';

  windowsApi = {
    getWindowLong: user32.func(
      `${longPtrType} __stdcall ${getWindowLongName}(void *hWnd, int nIndex)`
    ),
    setWindowLong: user32.func(
      `${longPtrType} __stdcall ${setWindowLongName}(void *hWnd, int nIndex, ${longPtrType} value)`
    ),
    setWindowPos: user32.func(
      'bool __stdcall SetWindowPos(void *hWnd, void *hWndInsertAfter, int x, int y, int cx, int cy, uint flags)'
    )
  };
  return windowsApi;
}

function nativeWindowHandle(browserWindow) {
  const handle = browserWindow.getNativeWindowHandle();
  return process.arch === 'ia32'
    ? BigInt(handle.readUInt32LE(0))
    : handle.readBigUInt64LE(0);
}

function readExtendedStyle(browserWindow) {
  if (process.platform !== 'win32') {
    return 0n;
  }
  const api = loadWindowsApi();
  return BigInt(api.getWindowLong(nativeWindowHandle(browserWindow), GWL_EXSTYLE));
}

function hasNoActivateStyle(browserWindow) {
  if (process.platform !== 'win32') {
    return true;
  }
  try {
    return (readExtendedStyle(browserWindow) & WS_EX_NOACTIVATE) !== 0n;
  } catch {
    return false;
  }
}

function applyNoActivateStyle(browserWindow) {
  if (process.platform !== 'win32') {
    return true;
  }
  try {
    const api = loadWindowsApi();
    const hwnd = nativeWindowHandle(browserWindow);
    const currentStyle = BigInt(api.getWindowLong(hwnd, GWL_EXSTYLE));
    const nextStyle = currentStyle | WS_EX_NOACTIVATE;

    if (nextStyle !== currentStyle) {
      api.setWindowLong(hwnd, GWL_EXSTYLE, nextStyle);
      api.setWindowPos(
        hwnd,
        null,
        0,
        0,
        0,
        0,
        SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED
      );
    }
    return hasNoActivateStyle(browserWindow);
  } catch (error) {
    console.warn(`Unable to apply no-activate style: ${error.message}`);
    return false;
  }
}

module.exports = {
  WS_EX_NOACTIVATE,
  applyNoActivateStyle,
  hasNoActivateStyle
};

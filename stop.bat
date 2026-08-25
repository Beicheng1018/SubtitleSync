@echo off
setlocal
cd /d "%~dp0"
set "ELECTRON_EXE=%CD%\node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON_EXE%" (
  echo SubtitleSync Electron executable was not found:
  echo %ELECTRON_EXE%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$target = [System.IO.Path]::GetFullPath($env:ELECTRON_EXE); $processes = Get-Process -Name electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -and [System.String]::Equals($_.Path, $target, [System.StringComparison]::OrdinalIgnoreCase) }; if (-not $processes) { Write-Output 'SubtitleSync is not running.'; exit 0 }; $processes | Stop-Process -Force; Write-Output ('Stopped SubtitleSync Electron process(es): ' + $processes.Count)"
set "EXIT_CODE=%ERRORLEVEL%"

pause
exit /b %EXIT_CODE%

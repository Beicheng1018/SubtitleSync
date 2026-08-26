@echo off
setlocal
cd /d "%~dp0"

set "NO_PAUSE="
if /I "%~1"=="--no-pause" set "NO_PAUSE=1"

set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
set "BUILD_EXIT_CODE=1"

echo SubtitleSync Windows build
echo Working directory: %CD%
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 goto :npm_missing

if not exist "%CD%\node_modules\.bin\electron-builder.cmd" goto :dependencies_missing

if not defined PYTHON_EXE (
  if exist "D:\Anaconda\python.exe" (
    set "PYTHON_EXE=D:\Anaconda\python.exe"
  ) else (
    set "PYTHON_EXE=python"
  )
)

echo Python executable: %PYTHON_EXE%
"%PYTHON_EXE%" --version
if errorlevel 1 goto :python_missing

echo.
echo [1/3] Running Electron checks...
call npm run check
if errorlevel 1 goto :electron_check_failed

echo.
echo [2/3] Running Python tests...
"%PYTHON_EXE%" -m pytest
if errorlevel 1 goto :python_tests_failed

echo.
echo [3/3] Building NSIS installer and portable executable...
call "%CD%\node_modules\.bin\electron-builder.cmd" --win nsis portable --publish never
if errorlevel 1 goto :package_failed

set "BUILD_EXIT_CODE=0"
echo.
echo Build completed successfully.
echo EXE files currently available in release:
if exist "%CD%\release" (
  for /r "%CD%\release" %%F in (*.exe) do echo   %%~fF
) else (
  echo   No release directory was created.
)
goto :finish

:npm_missing
echo [ERROR] npm.cmd was not found. Install Node.js and npm, then try again.
goto :finish

:dependencies_missing
echo [ERROR] Local electron-builder was not found.
echo Run "npm install" in this directory, then try again.
goto :finish

:python_missing
echo [ERROR] Python could not be started with: %PYTHON_EXE%
echo Install Python 3.10 or later, or set PYTHON_EXE before running this script.
goto :finish

:electron_check_failed
echo [ERROR] Electron checks failed. Packaging was not started.
goto :finish

:python_tests_failed
echo [ERROR] Python tests failed. Packaging was not started.
goto :finish

:package_failed
echo [ERROR] electron-builder failed while creating the Windows packages.
goto :finish

:finish
echo.
if not defined NO_PAUSE pause
endlocal & exit /b %BUILD_EXIT_CODE%

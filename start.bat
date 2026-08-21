@echo off
cd /d "%~dp0"
set "PYTHON_EXE=D:\Anaconda\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

echo Working directory: %CD%
echo Python executable: %PYTHON_EXE%
"%PYTHON_EXE%" --version
echo.
echo Starting SubtitleSync Electron frontend...
npm start
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo SubtitleSync exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%

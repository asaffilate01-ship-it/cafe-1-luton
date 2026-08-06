@echo off
REM Cafe1 - Deliveroo shop watcher runner.
REM
REM Keeps the watcher alive for as long as the PC is on. If it ever stops -
REM Hub hiccup, network drop, crash - this restarts it after 15 seconds, so
REM the kitchen display never quietly loses the Deliveroo link.
REM
REM Settings are read from deliveroo-hub-watcher.env in this same folder.

setlocal enabledelayedexpansion
cd /d "%~dp0.."

set "ENVFILE=%~dp0deliveroo-hub-watcher.env"
if not exist "%ENVFILE%" (
  echo.
  echo Missing settings file:
  echo   %ENVFILE%
  echo.
  echo Copy deliveroo-hub-watcher.env.example to deliveroo-hub-watcher.env
  echo and fill in the Deliveroo device login and the bridge secret.
  echo.
  pause
  exit /b 1
)

REM Load KEY=VALUE lines, ignoring blanks and # comments.
for /f "usebackq tokens=1,* delims==" %%A in ("%ENVFILE%") do (
  set "KEY=%%A"
  if not "!KEY!"=="" if not "!KEY:~0,1!"=="#" set "!KEY!=%%B"
)

if not exist "%~dp0logs" mkdir "%~dp0logs"
set "LOGFILE=%~dp0logs\deliveroo-hub-watcher.log"

REM Do not start a second browser against the same saved Hub session. Two
REM copies contend for Chromium/session files and Windows repeatedly reports
REM "The process cannot access the file because it is being used by another
REM process." The installer safely stops the old copy before updating it.
set "WATCHER_RUNNING="
for /f %%P in ('powershell.exe -NoProfile -Command "$me=[regex]::Escape('%~dp0deliveroo-hub-watcher.mjs'); if (Get-CimInstance Win32_Process -Filter 'Name = ''node.exe''' -ErrorAction SilentlyContinue ^| Where-Object { $_.CommandLine -match $me }) { 'yes' }"') do set "WATCHER_RUNNING=%%P"
if defined WATCHER_RUNNING (
  echo.
  echo Cafe1 Deliveroo watcher is already running.
  echo Do not open a second copy. To update it, run install-deliveroo-watcher.ps1.
  echo.
  pause
  exit /b 0
)

:loop
echo [%date% %time%] starting Deliveroo watcher >> "%LOGFILE%"
node "%~dp0deliveroo-hub-watcher.mjs" >> "%LOGFILE%" 2>&1
echo [%date% %time%] watcher stopped - restarting in 15s >> "%LOGFILE%"
timeout /t 15 /nobreak > nul
goto loop
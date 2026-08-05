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

:loop
echo [%date% %time%] starting Deliveroo watcher >> "%LOGFILE%"
node "%~dp0deliveroo-hub-watcher.mjs" >> "%LOGFILE%" 2>&1
echo [%date% %time%] watcher stopped - restarting in 15s >> "%LOGFILE%"
timeout /t 15 /nobreak > nul
goto loop
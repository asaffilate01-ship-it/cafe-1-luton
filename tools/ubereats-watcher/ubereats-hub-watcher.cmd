@echo off
setlocal
cd /d "%~dp0"

if not exist "%~dp0logs" mkdir "%~dp0logs"
set "LOGFILE=%~dp0logs\ubereats-hub-watcher.log"

:loop
for %%A in ("%LOGFILE%") do if %%~zA GTR 5242880 (
  move /y "%LOGFILE%" "%LOGFILE%.previous" >nul 2>&1
)
echo [%date% %time%] starting Cafe 1 Uber Eats watcher >> "%LOGFILE%"
call "%~dp0watcher-runtime.cmd" >> "%LOGFILE%" 2>&1
set "WATCHER_EXIT=%ERRORLEVEL%"
if "%WATCHER_EXIT%"=="20" (
  echo [%date% %time%] Uber Eats login required; waiting five minutes >> "%LOGFILE%"
  timeout /t 300 /nobreak >nul
) else (
  echo [%date% %time%] watcher stopped with %WATCHER_EXIT%; restarting in 15 seconds >> "%LOGFILE%"
  timeout /t 15 /nobreak >nul
)
goto loop

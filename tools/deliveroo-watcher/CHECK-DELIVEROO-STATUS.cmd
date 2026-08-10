@echo off
title Cafe 1 Deliveroo Status
cd /d "%~dp0"
call "%~dp0watcher-runtime.cmd" --check
echo.
if errorlevel 1 (
  echo NOT CONNECTED - run START-CAFE1-DELIVEROO.cmd to repair it.
) else (
  echo CONNECTED - the Cafe 1 KDS bridge accepted the watcher heartbeat.
)
echo.
echo Recent activity:
powershell.exe -NoProfile -Command "if (Test-Path '%~dp0logs\deliveroo-hub-watcher.log') { Get-Content '%~dp0logs\deliveroo-hub-watcher.log' -Tail 12 }"
pause

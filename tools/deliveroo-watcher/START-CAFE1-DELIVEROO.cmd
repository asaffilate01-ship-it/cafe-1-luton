@echo off
title Cafe 1 Deliveroo Setup
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-deliveroo-watcher.ps1"
if errorlevel 1 (
  echo.
  echo Setup did not finish. Read the message above, then run this file again.
  pause
)

@echo off
title Repair Cafe 1 Just Eat Login
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-justeat-watcher.ps1"

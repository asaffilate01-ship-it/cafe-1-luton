@echo off
title Repair Cafe 1 Deliveroo Login
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-deliveroo-watcher.ps1"

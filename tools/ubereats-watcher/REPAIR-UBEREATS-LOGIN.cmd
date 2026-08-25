@echo off
title Repair Cafe 1 Uber Eats Login
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-ubereats-watcher.ps1"

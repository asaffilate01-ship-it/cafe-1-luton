@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"

set "SECRET_FILE=%~dp0bridge-secret.dpapi"
if not exist "%SECRET_FILE%" (
  echo Protected bridge key is missing. Run START-CAFE1-DELIVEROO.cmd.
  exit /b 2
)

for /f "usebackq delims=" %%S in (`powershell.exe -NoProfile -Command "$secure=Get-Content -Raw '%SECRET_FILE%' ^| ConvertTo-SecureString; $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }"`) do set "DELIVEROO_BRIDGE_SECRET=%%S"
if not defined DELIVEROO_BRIDGE_SECRET (
  echo Protected bridge key could not be opened for this Windows user.
  exit /b 2
)

set "NODE_EXE=%~dp0.runtime\node.exe"
if not exist "%NODE_EXE%" (
  for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined SYSTEM_NODE set "SYSTEM_NODE=%%N"
  set "NODE_EXE=%SYSTEM_NODE%"
)
if not defined NODE_EXE (
  echo Private Node runtime is missing. Run START-CAFE1-DELIVEROO.cmd.
  exit /b 2
)

"%NODE_EXE%" "%~dp0deliveroo-hub-watcher.mjs" %*
exit /b %ERRORLEVEL%

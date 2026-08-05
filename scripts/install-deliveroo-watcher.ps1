<#
  Cafe1 - install the Deliveroo watcher so it runs whenever this PC is on.

  Run this ONCE on the shop PC, right-click this file and choose
  "Run with PowerShell" (or run it from an Administrator PowerShell window).

  It creates a Windows scheduled task that starts the watcher at startup and
  at sign-in, keeps it running in the background, and restarts it if it ever
  stops. After this, nobody has to remember to start anything.

  To remove it later:
    Unregister-ScheduledTask -TaskName "Cafe1 Deliveroo Watcher" -Confirm:$false
#>

$ErrorActionPreference = "Stop"

$taskName = "Cafe1 Deliveroo Watcher"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $scriptDir "deliveroo-hub-watcher.cmd"
$envFile = Join-Path $scriptDir "deliveroo-hub-watcher.env"

if (-not (Test-Path $runner)) {
  Write-Host "Could not find $runner - run this from inside the Cafe1 scripts folder." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $envFile)) {
  Write-Host ""
  Write-Host "Settings file not found." -ForegroundColor Yellow
  Write-Host "Copy deliveroo-hub-watcher.env.example to deliveroo-hub-watcher.env,"
  Write-Host "fill in the Deliveroo device login and the bridge secret, then run this again."
  Write-Host ""
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed on this PC. Install it from https://nodejs.org first." -ForegroundColor Red
  exit 1
}

# Install the watcher's private browser package and Chromium automatically.
# Using npm.cmd directly avoids npx's interactive "install this package?" prompt.
Write-Host "Installing the private browser used by the watcher (first time only)..."
Push-Location $scriptDir
try {
  & npm.cmd install --no-save --no-audit --no-fund --silent playwright
  if ($LASTEXITCODE -ne 0) { throw "The Playwright package could not be installed." }

  & npx.cmd --no-install playwright install chromium
  if ($LASTEXITCODE -ne 0) { throw "The Chromium browser could not be installed." }
} finally {
  Pop-Location
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$runner`"" -WorkingDirectory $scriptDir

$triggers = @(
  (New-ScheduledTaskTrigger -AtStartup),
  (New-ScheduledTaskTrigger -AtLogOn)
)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers `
  -Settings $settings -Principal $principal `
  -Description "Mirrors Deliveroo Restaurant Hub orders onto the Cafe1 kitchen display." | Out-Null

Start-ScheduledTask -TaskName $taskName

Write-Host ""
Write-Host "Done. The Deliveroo watcher now starts on its own whenever this PC is on." -ForegroundColor Green
Write-Host "Within a minute the kitchen display should show a green 'Deliveroo auto' badge."
Write-Host ""
Write-Host "Log file: $scriptDir\logs\deliveroo-hub-watcher.log"
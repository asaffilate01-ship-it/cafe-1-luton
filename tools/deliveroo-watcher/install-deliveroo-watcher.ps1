<#
  Cafe 1 one-click Deliveroo watcher installer.

  Installs into the current Windows user's LocalAppData, provisions a private
  Node LTS runtime when needed, uses the installed Edge/Chrome browser, saves
  the bridge key with Windows DPAPI and registers an auto-restarting task.
  Deliveroo credentials are entered only into Restaurant Hub's own page.
#>

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$taskName = "Cafe1 Deliveroo Watcher"
$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installDir = Join-Path $env:LOCALAPPDATA "Cafe1\DeliverooWatcher"
$sourceFiles = @(
  "deliveroo-hub-watcher.mjs",
  "deliveroo-hub-watcher.cmd",
  "watcher-runtime.cmd",
  "watcher-launcher.vbs",
  "install-deliveroo-watcher.ps1",
  "START-CAFE1-DELIVEROO.cmd",
  "REPAIR-DELIVEROO-LOGIN.cmd",
  "CHECK-DELIVEROO-STATUS.cmd",
  "package.json",
  "package-lock.json",
  "README-FIRST.txt"
)

function Write-Step([string]$message) {
  Write-Host ""
  Write-Host "  $message" -ForegroundColor Cyan
}

function Stop-Watcher {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  $escaped = [regex]::Escape($installDir)
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and $_.CommandLine -match $escaped -and
      ($_.CommandLine -match "deliveroo-hub-watcher" -or $_.CommandLine -match "watcher-launcher")
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}

function Repair-InstallAccess {
  # An earlier install can leave the folder locked down or the files read-only,
  # which makes the upgrade copy fail with "Access to the path ... is denied".
  if (-not (Test-Path $installDir)) { return }
  $me = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & takeown.exe /F $installDir /R /D Y 2>&1 | Out-Null
  & icacls.exe $installDir /reset /T /C /Q 2>&1 | Out-Null
  & icacls.exe $installDir /grant:r "*${me}:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" /T /C /Q 2>&1 | Out-Null
  Get-ChildItem $installDir -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object { $_.IsReadOnly } |
    ForEach-Object { try { $_.IsReadOnly = $false } catch { } }
}

function Copy-WatcherFile([string]$from, [string]$to) {
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      if (Test-Path $to) {
        try { (Get-Item $to -Force).IsReadOnly = $false } catch { }
        Remove-Item $to -Force -ErrorAction SilentlyContinue
      }
      Copy-Item $from $to -Force
      return
    } catch {
      if ($attempt -eq 5) {
        throw "Cannot update $([System.IO.Path]::GetFileName($to)). Close any Cafe 1 watcher windows, sign out and back into Windows, then run setup again. ($($_.Exception.Message))"
      }
      Stop-Watcher
      Repair-InstallAccess
      Start-Sleep -Seconds 2
    }
  }
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor DarkCyan
Write-Host "     CAFE 1 - DELIVEROO TO KDS ONE-CLICK SETUP" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor DarkCyan
Write-Host "This keeps the Deliveroo tablet unchanged and mirrors accepted orders to KDS."
Write-Host "No Deliveroo password is stored by Cafe 1."

if (-not (Test-Path $installDir)) {
  New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

if ([System.IO.Path]::GetFullPath($sourceDir).TrimEnd('\') -ne [System.IO.Path]::GetFullPath($installDir).TrimEnd('\')) {
  Write-Step "Installing the watcher in your Windows profile"
  Stop-Watcher
  foreach ($file in $sourceFiles) {
    $from = Join-Path $sourceDir $file
    if (-not (Test-Path $from)) { throw "The download is incomplete: $file is missing." }
    Copy-Item $from (Join-Path $installDir $file) -Force
  }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $installDir "install-deliveroo-watcher.ps1")
  exit $LASTEXITCODE
}

Stop-Watcher

$configFile = Join-Path $installDir "watcher.config.json"
@{
  cafe1Url = "https://cafe1stalbans.co.uk"
  hubUrl = "https://restaurant-hub.deliveroo.net/orders"
  refreshMs = 45000
} | ConvertTo-Json | Set-Content -Path $configFile -Encoding UTF8

$secretFile = Join-Path $installDir "bridge-secret.dpapi"
$bridgeKey = $null
if (Test-Path $secretFile) {
  try {
    $saved = Get-Content -Raw $secretFile | ConvertTo-SecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($saved)
    try { $bridgeKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  } catch {
    Remove-Item $secretFile -Force
  }
}
if (-not $bridgeKey) {
  $bytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes) } finally { $random.Dispose() }
  $bridgeKey = -join ($bytes | ForEach-Object { $_.ToString("x2") })
  ConvertTo-SecureString $bridgeKey -AsPlainText -Force |
    ConvertFrom-SecureString |
    Set-Content -Path $secretFile -Encoding ASCII
}

function Resolve-NodeRuntime {
  $portableNode = Join-Path $installDir ".runtime\node.exe"
  if (Test-Path $portableNode) { return $portableNode }

  $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($systemNode) {
    $major = [int]((& $systemNode.Source --version).TrimStart('v').Split('.')[0])
    if ($major -ge 20) { return $systemNode.Source }
  }

  Write-Step "Downloading a verified private Node.js LTS runtime"
  $release = Invoke-RestMethod "https://nodejs.org/dist/index.json" |
    Where-Object { $_.lts -and $_.files -contains "win-x64-zip" } |
    Select-Object -First 1
  if (-not $release) { throw "Could not find the current Node.js LTS Windows package." }
  $version = $release.version
  $archiveName = "node-$version-win-x64.zip"
  $baseUrl = "https://nodejs.org/dist/$version"
  $temporary = Join-Path $env:TEMP "cafe1-deliveroo-node-$version"
  $archive = "$temporary.zip"
  $expanded = "$temporary-expanded"
  Invoke-WebRequest "$baseUrl/$archiveName" -OutFile $archive
  $sums = (Invoke-WebRequest "$baseUrl/SHASUMS256.txt").Content
  $expected = (($sums -split "`n") | Where-Object { $_ -match [regex]::Escape($archiveName) } | Select-Object -First 1).Split(' ')[0]
  $actual = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if (-not $expected -or $actual -ne $expected.ToLowerInvariant()) {
    throw "The downloaded Node.js runtime did not match Node.js's published SHA-256 checksum."
  }
  Remove-Item $expanded -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive $archive -DestinationPath $expanded -Force
  $runtimeSource = Get-ChildItem $expanded -Directory | Select-Object -First 1
  Remove-Item (Join-Path $installDir ".runtime") -Recurse -Force -ErrorAction SilentlyContinue
  Move-Item $runtimeSource.FullName (Join-Path $installDir ".runtime")
  Remove-Item $archive, $expanded -Recurse -Force -ErrorAction SilentlyContinue
  return (Join-Path $installDir ".runtime\node.exe")
}

$nodeExe = Resolve-NodeRuntime
$nodeDir = Split-Path -Parent $nodeExe
$npmCmd = Join-Path $nodeDir "npm.cmd"
if (-not (Test-Path $npmCmd)) {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCommand) { throw "npm is missing from the Node.js runtime." }
  $npmCmd = $npmCommand.Source
}

Write-Step "Installing the small private browser controller"
Push-Location $installDir
try {
  & $npmCmd ci --omit=dev --no-audit --no-fund --silent
  if ($LASTEXITCODE -ne 0) { throw "The browser controller could not be installed." }
} finally {
  Pop-Location
}

# Limit local session/secret access to this Windows user, SYSTEM and administrators.
& icacls.exe $installDir /inheritance:r /grant:r `
  "$($env:USERDOMAIN)\$($env:USERNAME):(OI)(CI)F" `
  "SYSTEM:(OI)(CI)F" `
  "Administrators:(OI)(CI)F" /T /C | Out-Null

$env:DELIVEROO_BRIDGE_SECRET = $bridgeKey
Write-Step "Checking the protected Cafe 1 KDS bridge"
& $nodeExe (Join-Path $installDir "deliveroo-hub-watcher.mjs") --check
$bridgeReady = $LASTEXITCODE -eq 0
if (-not $bridgeReady) {
  $settings = "DELIVEROO_INGEST_MODE=hub_watcher`r`nDELIVEROO_BRIDGE_SECRET=$bridgeKey"
  Set-Clipboard $settings
  Write-Host ""
  Write-Host "The website needs its one-time bridge setting." -ForegroundColor Yellow
  Write-Host "The two required production settings are now copied to your clipboard."
  Write-Host "Paste them into the Lovable production secrets, redeploy, then return here."
  Write-Host "The Deliveroo key is protected on this PC and is not a Deliveroo password."
  Write-Host ""
  Read-Host "After the website has redeployed, press Enter to check again"
  & $nodeExe (Join-Path $installDir "deliveroo-hub-watcher.mjs") --check
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "The website bridge is still not ready. Nothing unsafe was installed." -ForegroundColor Red
    Write-Host "Run START-CAFE1-DELIVEROO.cmd again after the settings are live."
    exit 3
  }
}

Write-Step "Connecting the always-on Deliveroo device account"
Write-Host "A Microsoft Edge window will open. Sign into Restaurant Hub once using the"
Write-Host "same device account used at the cafe. Do not type the password into this installer."
& $nodeExe (Join-Path $installDir "deliveroo-hub-watcher.mjs") --setup
if ($LASTEXITCODE -ne 0) { throw "Deliveroo Restaurant Hub sign-in did not complete." }

Write-Step "Making the watcher stay on automatically"
$runner = Join-Path $installDir "watcher-launcher.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$runner`"" -WorkingDirectory $installDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Limited
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description "Keeps accepted Deliveroo Restaurant Hub orders flowing to Cafe 1 KDS." | Out-Null
Start-ScheduledTask -TaskName $taskName

$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
foreach ($shortcut in @(
  @{ Name = "Cafe 1 Deliveroo Status.lnk"; Target = "CHECK-DELIVEROO-STATUS.cmd" },
  @{ Name = "Repair Deliveroo Login.lnk"; Target = "REPAIR-DELIVEROO-LOGIN.cmd" }
)) {
  $link = $shell.CreateShortcut((Join-Path $desktop $shortcut.Name))
  $link.TargetPath = Join-Path $installDir $shortcut.Target
  $link.WorkingDirectory = $installDir
  $link.Save()
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor DarkGreen
Write-Host "  CONNECTED - DELIVEROO ORDERS WILL FLOW TO CAFE 1 KDS" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor DarkGreen
Write-Host "The watcher starts at Windows sign-in, stays hidden and restarts automatically."
Write-Host "Use the new Cafe 1 Deliveroo Status desktop shortcut at any time."
Write-Host "Installed in: $installDir"
Write-Host ""
Read-Host "Press Enter to close"

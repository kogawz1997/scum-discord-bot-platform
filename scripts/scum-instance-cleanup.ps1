param(
  [int]$KeepPid,
  [string]$ScumRoot = $env:SCUM_SERVER_ROOT,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ScumRoot)) {
  $ScumRoot = 'Z:\SteamLibrary\steamapps\common\SCUM Server'
}

$processes = Get-Process SCUMServer -ErrorAction SilentlyContinue | Sort-Object Id

if (-not $processes) {
  Write-Host 'No SCUMServer process found.' -ForegroundColor Yellow
  exit 0
}

if (-not $KeepPid) {
  Write-Host 'Usage: powershell -File scripts/scum-instance-cleanup.ps1 -KeepPid <pid>' -ForegroundColor Yellow
  Write-Host 'Tip: run scripts/scum-instance-audit.ps1 first to choose the main instance.' -ForegroundColor Yellow
  exit 1
}

$keep = $processes | Where-Object { $_.Id -eq $KeepPid }
if (-not $keep) {
  Write-Host "KeepPid $KeepPid not found among running SCUMServer processes." -ForegroundColor Red
  exit 1
}

$targets = $processes | Where-Object { $_.Id -ne $KeepPid }

Write-Host "Keeping PID: $KeepPid" -ForegroundColor Green
if (-not $targets) {
  Write-Host 'No extra SCUMServer processes to stop.' -ForegroundColor Green
  exit 0
}

Write-Host 'Targets to stop:' -ForegroundColor Cyan
$targets | Select-Object Id, StartTime | Format-Table -AutoSize

if ($WhatIf) {
  Write-Host 'WhatIf enabled: no process was stopped.' -ForegroundColor Yellow
  exit 0
}

$failed = @()

foreach ($target in $targets) {
  try {
    Stop-Process -Id $target.Id -Force -ErrorAction Stop
    Write-Host "Stopped PID $($target.Id)" -ForegroundColor Green
  } catch {
    $failed += $target.Id
    Write-Host "Failed to stop PID $($target.Id): $($_.Exception.Message)" -ForegroundColor Red
  }
}

if ($failed.Count -gt 0) {
  Write-Host ''
  Write-Host 'Some processes could not be stopped. Re-run this script in an elevated PowerShell (Run as Administrator).' -ForegroundColor Yellow
  Write-Host ("Failed PIDs: " + ($failed -join ', ')) -ForegroundColor Yellow
  exit 2
}

Write-Host ''
Write-Host 'Cleanup complete. Recommended next step:' -ForegroundColor Green
Write-Host '  1. verify only one instance remains'
Write-Host '  2. confirm BattlEye RCon port matches .env'
Write-Host '  3. restart bot/worker if RCon target changed'

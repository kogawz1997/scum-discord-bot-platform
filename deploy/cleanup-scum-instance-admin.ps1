param(
  [int]$KeepPid = 69992
)

$ErrorActionPreference = 'Stop'

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Start-Process PowerShell -Verb RunAs -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $PSCommandPath,
    '-KeepPid', $KeepPid
  )
  exit 0
}

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$cleanupScript = Join-Path $rootDir 'scripts\scum-instance-cleanup.ps1'
$auditScript = Join-Path $rootDir 'scripts\scum-instance-audit.ps1'

Write-Host "Running elevated cleanup. Keeping PID $KeepPid" -ForegroundColor Cyan
& $cleanupScript -KeepPid $KeepPid

Write-Host ''
Write-Host 'Post-cleanup audit' -ForegroundColor Cyan
& $auditScript

Write-Host ''
Read-Host 'Press Enter to close'

param(
  [string]$ScumRoot = $env:SCUM_SERVER_ROOT,
  [int]$ExpectedRconPort = 8038
)

$ErrorActionPreference = 'Stop'

function Resolve-ScumRoot {
  param([string]$PathValue)

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    $PathValue = 'Z:\SteamLibrary\steamapps\common\SCUM Server'
  }

  if (Test-Path $PathValue) {
    return (Resolve-Path $PathValue).Path
  }

  if ($PathValue -match '^([A-Za-z]):\\(.*)$') {
    $driveName = $matches[1]
    $subPath = $matches[2]
    $drive = Get-PSDrive -Name $driveName -ErrorAction SilentlyContinue
    if ($drive -and $drive.DisplayRoot) {
      $candidate = Join-Path $drive.DisplayRoot $subPath
      if (Test-Path $candidate) {
        return $candidate
      }
    }

    if ($driveName -ieq 'Z') {
      $candidate = Join-Path '\\BeeStation\Media' $subPath
      if (Test-Path $candidate) {
        return $candidate
      }
    }
  }

  return $PathValue
}

$ScumRoot = Resolve-ScumRoot $ScumRoot

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Start-Process PowerShell -Verb RunAs -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $PSCommandPath,
    '-ScumRoot', $ScumRoot,
    '-ExpectedRconPort', $ExpectedRconPort
  )
  exit 0
}

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$exePath = Join-Path $ScumRoot 'SCUM\Binaries\Win64\SCUMServer.exe'
$battleyeCfg = Join-Path $ScumRoot 'BattlEye\BEServer_x64.cfg'
$auditScript = Join-Path $rootDir 'scripts\scum-instance-audit.ps1'
$rconScript = Join-Path $rootDir 'scripts\rcon-send.js'

if (-not (Test-Path $exePath)) {
  throw "SCUMServer.exe not found: $exePath"
}

if (-not (Test-Path $battleyeCfg)) {
  throw "BattlEye config not found: $battleyeCfg"
}

Write-Host "Stopping existing SCUMServer processes..." -ForegroundColor Cyan
Get-Process SCUMServer -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    Stop-Process -Id $_.Id -Force -ErrorAction Stop
    Write-Host "Stopped PID $($_.Id)" -ForegroundColor Green
  } catch {
    Write-Host "Failed to stop PID $($_.Id): $($_.Exception.Message)" -ForegroundColor Red
    throw
  }
}

Start-Sleep -Seconds 3

$cfg = Get-Content $battleyeCfg -Raw
if ($cfg -notmatch "RConPort\s+$ExpectedRconPort") {
  Write-Host "WARNING: BattlEye config does not contain expected RConPort $ExpectedRconPort" -ForegroundColor Yellow
}

Write-Host "Starting SCUMServer.exe ..." -ForegroundColor Cyan
$proc = Start-Process -FilePath $exePath -WorkingDirectory (Split-Path $exePath) -ArgumentList '-log' -PassThru
Write-Host "Started PID $($proc.Id)" -ForegroundColor Green

Write-Host "Waiting for server bootstrap..." -ForegroundColor Cyan
Start-Sleep -Seconds 20

Write-Host ''
Write-Host 'Post-restart audit' -ForegroundColor Cyan
& $auditScript -ScumRoot $ScumRoot

Write-Host ''
Write-Host "Testing BattlEye RCon on port $ExpectedRconPort ..." -ForegroundColor Cyan
node $rconScript --protocol battleye --host 127.0.0.1 --port $ExpectedRconPort --password ((Get-Content $battleyeCfg | Where-Object { $_ -match '^RConPassword\s+' } | ForEach-Object { ($_ -split '\s+', 2)[1] })[0]) --command version

Write-Host ''
Read-Host 'Press Enter to close'

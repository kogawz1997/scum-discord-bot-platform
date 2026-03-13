param(
  [string]$ScumRoot = $env:SCUM_SERVER_ROOT
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

$logsDir = Join-Path $ScumRoot 'SCUM\Saved\Logs'
$saveDb = Join-Path $ScumRoot 'SCUM\Saved\SaveFiles\SCUM.db'
$battleyeCfg = Join-Path $ScumRoot 'BattlEye\BEServer_x64.cfg'

$processes = Get-Process SCUMServer -ErrorAction SilentlyContinue | Sort-Object Id

Write-Host '== SCUM Instance Audit ==' -ForegroundColor Cyan
Write-Host "ScumRoot     : $ScumRoot"
Write-Host "LogsDir      : $logsDir"
Write-Host "SaveDatabase : $saveDb"
Write-Host "BattlEyeCfg  : $battleyeCfg"
Write-Host ''

if (-not $processes) {
  Write-Host 'No SCUMServer process found.' -ForegroundColor Yellow
  exit 0
}

$pids = @($processes | Select-Object -ExpandProperty Id)

$udp = Get-NetUDPEndpoint -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess -in $pids } |
  Sort-Object OwningProcess, LocalPort

$tcp = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess -in $pids } |
  Sort-Object OwningProcess, LocalPort

Write-Host 'Processes:' -ForegroundColor Green
$processes |
  Select-Object Id, CPU, StartTime,
    @{ Name = 'WorkingSetMB'; Expression = { [math]::Round($_.WS / 1MB, 1) } },
    @{ Name = 'PrivateMB'; Expression = { [math]::Round($_.PM / 1MB, 1) } } |
  Format-Table -AutoSize

Write-Host ''
Write-Host 'UDP listeners:' -ForegroundColor Green
if ($udp) {
  $udp | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize
} else {
  Write-Host '  none'
}

Write-Host ''
Write-Host 'TCP listeners:' -ForegroundColor Green
if ($tcp) {
  $tcp | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize
} else {
  Write-Host '  none'
}

if (Test-Path $battleyeCfg) {
  Write-Host ''
  Write-Host 'BattlEye config:' -ForegroundColor Green
  Get-Content $battleyeCfg | ForEach-Object { Write-Host "  $_" }
}

if (Test-Path $saveDb) {
  Write-Host ''
  Write-Host 'Save DB:' -ForegroundColor Green
  Get-Item $saveDb |
    Select-Object FullName, Length, LastWriteTime |
    Format-List
}

if (Test-Path $logsDir) {
  Write-Host ''
  Write-Host 'Recent logs:' -ForegroundColor Green
  Get-ChildItem $logsDir -Filter 'SCUM*.log' |
    Sort-Object LastWriteTime -Descending |
    Select-Object Name, Length, LastWriteTime |
    Format-Table -AutoSize
}

Write-Host ''
if ($processes.Count -gt 1) {
  Write-Host "WARNING: found $($processes.Count) SCUMServer instances. Shared SaveFiles/DB is risky." -ForegroundColor Yellow
} else {
  Write-Host 'OK: only one SCUMServer instance found.' -ForegroundColor Green
}

param(
  [string]$ControlPlaneUrl,
  [string]$SetupToken,
  [string]$AgentToken,
  [string]$TenantId,
  [string]$ServerId,
  [string]$RuntimeKey = 'delivery-agent-main',
  [string]$AgentId = 'delivery-agent-main',
  [string]$DisplayName = 'Delivery Agent',
  [string]$ConsoleAgentToken,
  [string]$Backend = 'exec',
  [string]$ListenHost = '0.0.0.0',
  [int]$Port = 3213,
  [string]$BaseUrl,
  [string]$ExecTemplate,
  [string]$ServerExe,
  [string]$ServerWorkdir,
  [string]$ServerArgsJson = '[]',
  [switch]$AutoStartServer,
  [string]$EnvFilePath = '.runtime\delivery-agent.env',
  [string]$LoaderPath = '.runtime\load-delivery-agent-env.ps1',
  [switch]$Production,
  [switch]$StartBot,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'

function Require-Value([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "$Name is required"
  }
}

function Escape-SingleQuotes([string]$Value) {
  return ($Value -replace "'", "''")
}

function Format-DotEnvValue([string]$Value) {
  if ($null -eq $Value) {
    return '""'
  }
  $trimmed = [string]$Value
  if ($trimmed -match '^[A-Za-z0-9_:\\/\\.\\-]+$') {
    return $trimmed
  }
  return '"' + ($trimmed -replace '"', '\"') + '"'
}

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "[install-delivery-agent] $Message" -ForegroundColor Cyan
}

function Start-DetachedPowerShell([string]$CommandText) {
  if ([string]::IsNullOrWhiteSpace($CommandText)) {
    return
  }
  Start-Process powershell -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command', $CommandText
  ) | Out-Null
}

if ($Help) {
  Write-Host 'Usage: powershell -File scripts/install-delivery-agent.ps1 -ConsoleAgentToken <token> [-ControlPlaneUrl <url> -SetupToken <token>] [-Backend exec|process] [options]' -ForegroundColor Yellow
  Write-Host 'Writes a machine-local env file and a reusable PowerShell loader for Delivery Agent.' -ForegroundColor Yellow
  return
}

if ([string]::IsNullOrWhiteSpace($ConsoleAgentToken)) {
  $ConsoleAgentToken = Read-Host 'Enter SCUM console-agent token'
}
Require-Value 'ConsoleAgentToken' $ConsoleAgentToken
if ((-not [string]::IsNullOrWhiteSpace($SetupToken)) -or (-not [string]::IsNullOrWhiteSpace($AgentToken)) -or (-not [string]::IsNullOrWhiteSpace($ControlPlaneUrl))) {
  Require-Value 'ControlPlaneUrl' $ControlPlaneUrl
  Require-Value 'TenantId' $TenantId
  Require-Value 'ServerId' $ServerId
}
if ($Backend -eq 'exec' -and [string]::IsNullOrWhiteSpace($ExecTemplate)) {
  $defaultTemplate = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$((Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')) 'scripts\send-scum-admin-command.ps1'))`" -WindowTitle `"SCUM`" -WindowProcessName `"SCUM`" -Command `"{command}`""
  Write-Step 'No exec template provided, using the default SCUM command bridge'
  $ExecTemplate = $defaultTemplate
}
if ($Backend -eq 'process' -and $AutoStartServer -and [string]::IsNullOrWhiteSpace($ServerExe)) {
  throw 'ServerExe is required when Backend=process and AutoStartServer is enabled'
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$resolvedEnvFilePath = Join-Path $repoRoot $EnvFilePath
$resolvedLoaderPath = Join-Path $repoRoot $LoaderPath
$envDir = Split-Path -Parent $resolvedEnvFilePath
$loaderDir = Split-Path -Parent $resolvedLoaderPath

if (-not [string]::IsNullOrWhiteSpace($envDir)) {
  New-Item -ItemType Directory -Force -Path $envDir | Out-Null
}
if (-not [string]::IsNullOrWhiteSpace($loaderDir)) {
  New-Item -ItemType Directory -Force -Path $loaderDir | Out-Null
}

$resolvedBaseUrl = if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  "http://$ListenHost`:$Port"
} else {
  $BaseUrl.TrimEnd('/')
}

$pairs = [ordered]@{
  'SCUM_CONSOLE_AGENT_TOKEN' = $ConsoleAgentToken
  'SCUM_CONSOLE_AGENT_BACKEND' = $Backend
  'SCUM_CONSOLE_AGENT_HOST' = $ListenHost
  'SCUM_CONSOLE_AGENT_PORT' = [string]$Port
  'SCUM_CONSOLE_AGENT_BASE_URL' = $resolvedBaseUrl
  'SCUM_CONSOLE_AGENT_NAME' = $DisplayName
  'SCUM_AGENT_ID' = $AgentId
  'SCUM_AGENT_RUNTIME_KEY' = $RuntimeKey
  'PLATFORM_AGENT_DISPLAY_NAME' = $DisplayName
}

if (-not [string]::IsNullOrWhiteSpace($ControlPlaneUrl)) {
  $pairs['PLATFORM_API_BASE_URL'] = $ControlPlaneUrl.TrimEnd('/')
}
if (-not [string]::IsNullOrWhiteSpace($SetupToken)) {
  $pairs['PLATFORM_AGENT_SETUP_TOKEN'] = $SetupToken
}
if (-not [string]::IsNullOrWhiteSpace($AgentToken)) {
  $pairs['PLATFORM_AGENT_TOKEN'] = $AgentToken
}
if (-not [string]::IsNullOrWhiteSpace($TenantId)) {
  $pairs['PLATFORM_TENANT_ID'] = $TenantId
}
if (-not [string]::IsNullOrWhiteSpace($ServerId)) {
  $pairs['PLATFORM_SERVER_ID'] = $ServerId
}

if (-not [string]::IsNullOrWhiteSpace($ExecTemplate)) {
  $pairs['SCUM_CONSOLE_AGENT_EXEC_TEMPLATE'] = $ExecTemplate
}
if (-not [string]::IsNullOrWhiteSpace($ServerExe)) {
  $pairs['SCUM_CONSOLE_AGENT_SERVER_EXE'] = $ServerExe
}
if (-not [string]::IsNullOrWhiteSpace($ServerWorkdir)) {
  $pairs['SCUM_CONSOLE_AGENT_SERVER_WORKDIR'] = $ServerWorkdir
}
if (-not [string]::IsNullOrWhiteSpace($ServerArgsJson)) {
  $pairs['SCUM_CONSOLE_AGENT_SERVER_ARGS_JSON'] = $ServerArgsJson
}
if ($AutoStartServer) {
  $pairs['SCUM_CONSOLE_AGENT_AUTOSTART'] = 'true'
}

$resolvedDisplayName = if ([string]::IsNullOrWhiteSpace($DisplayName)) {
  'Delivery Agent'
} else {
  $DisplayName.Trim()
}
$pairs['SCUM_CONSOLE_AGENT_NAME'] = $resolvedDisplayName
$pairs['PLATFORM_AGENT_DISPLAY_NAME'] = $resolvedDisplayName

$dotenvLines = @(
  '# Generated by scripts/install-delivery-agent.ps1',
  "# GeneratedAt=$([DateTime]::UtcNow.ToString('o'))"
)
foreach ($entry in $pairs.GetEnumerator()) {
  $dotenvLines += "$($entry.Key)=$(Format-DotEnvValue $entry.Value)"
}

$loaderLines = @(
  '$ErrorActionPreference = ''Stop''',
  '# Generated by scripts/install-delivery-agent.ps1'
)
foreach ($entry in $pairs.GetEnumerator()) {
  $loaderLines += "`$env:$($entry.Key) = '$(Escape-SingleQuotes ([string]$entry.Value))'"
}
$loaderLines += "Write-Host '[delivery-agent-env] Environment loaded for console-agent' -ForegroundColor Green"

Set-Content -Path $resolvedEnvFilePath -Value ($dotenvLines -join "`r`n") -Encoding utf8
Set-Content -Path $resolvedLoaderPath -Value ($loaderLines -join "`r`n") -Encoding utf8

Write-Step 'Wrote delivery-agent env file'
Write-Host $resolvedEnvFilePath -ForegroundColor Green

Write-Step 'Wrote PowerShell loader'
Write-Host $resolvedLoaderPath -ForegroundColor Green

Write-Step 'Validating generated env bundle'
$validationCommand = @(
  'node',
  'scripts/runtime-env-check.js',
  '--role', 'delivery-agent',
  '--env-file', ('"' + [string]$resolvedEnvFilePath + '"')
)
if ($Production) {
  $validationCommand += '--production'
}
cmd /c ($validationCommand -join ' ')
if ($LASTEXITCODE -ne 0) {
  throw 'Generated delivery-agent env bundle failed validation'
}

Write-Step 'Next commands'
Write-Host ". $resolvedLoaderPath" -ForegroundColor Yellow
Write-Host 'node apps/agent/server.js' -ForegroundColor Yellow
Write-Host "node scripts/runtime-env-check.js --role delivery-agent --env-file `"$resolvedEnvFilePath`"$(if ($Production) { ' --production' } else { '' })" -ForegroundColor Yellow
Write-Host 'node scripts/machine-validation.js --role delivery-agent --production' -ForegroundColor Yellow
if (-not [string]::IsNullOrWhiteSpace($TenantId) -and -not [string]::IsNullOrWhiteSpace($ServerId)) {
  Write-Host "node scripts/runtime-inventory-report.js --role delivery-agent --tenant-id=$TenantId --server-id=$ServerId" -ForegroundColor Yellow
}

if ($StartBot) {
  Write-Step 'Starting Delivery Agent'
  $repoRootQuoted = Escape-SingleQuotes ([string]$repoRoot)
  $loaderQuoted = Escape-SingleQuotes ([string]$resolvedLoaderPath)
  Start-DetachedPowerShell "Set-Location '$repoRootQuoted'; . '$loaderQuoted'; node apps/agent/server.js"
  Write-Host 'Delivery Agent start command was opened in a new PowerShell window.' -ForegroundColor Green
}

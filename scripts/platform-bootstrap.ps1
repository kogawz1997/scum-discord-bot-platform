$ErrorActionPreference = 'Stop'

param(
  [ValidateSet('production', 'single-host-prod', 'multi-tenant-prod', 'machine-a-control-plane', 'machine-b-game-bot', 'development', 'test')]
  [string]$Profile = 'production',
  [switch]$PrepareEnv
)

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "[platform-bootstrap] $Message" -ForegroundColor Cyan
}

function Invoke-Step([string[]]$Command) {
  & $Command[0] $Command[1..($Command.Length - 1)]
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $($Command -join ' ')"
  }
}

Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

$ExecutionNodeProfiles = @('machine-b-game-bot')
$ControlPlaneProfiles = @('production', 'single-host-prod', 'multi-tenant-prod', 'machine-a-control-plane')
$PrismaProvider = if ($env:PRISMA_SCHEMA_PROVIDER) { $env:PRISMA_SCHEMA_PROVIDER } elseif ($env:DATABASE_PROVIDER) { $env:DATABASE_PROVIDER } else { 'sqlite' }

if ($PrepareEnv) {
  Write-Step "Preparing env files for profile $Profile"
  Invoke-Step @('node', 'scripts/setup-env-profile.js', "--profile=$Profile", '--write', '--force')
}

Write-Step "Installing npm dependencies"
Invoke-Step @('npm.cmd', 'install')

if ($ExecutionNodeProfiles -contains $Profile) {
  Write-Step "Running topology validation for execution node"
  Invoke-Step @('npm.cmd', 'run', 'doctor:topology:prod')

  Write-Step "Execution-node bootstrap complete"
  Write-Host "Next: start deploy/pm2.machine-b-game-bot.config.cjs on the SCUM workstation and validate watcher + console-agent health." -ForegroundColor Green
  Write-Host "Profile used: $Profile" -ForegroundColor DarkGray
  Write-Host "Reference: docs/TWO_MACHINE_AGENT_TOPOLOGY.md" -ForegroundColor DarkGray
  return
}

if ($ControlPlaneProfiles -contains $Profile) {
  Write-Step "Generating Prisma client"
  Invoke-Step @('node', 'scripts/prisma-with-provider.js', '--provider', $PrismaProvider, 'generate')

  Write-Step "Applying Prisma migrations when available"
  try {
    Invoke-Step @('node', 'scripts/prisma-with-provider.js', '--provider', $PrismaProvider, 'migrate', 'deploy')
  } catch {
    Write-Host "[platform-bootstrap] prisma migrate deploy skipped or baseline-required, continuing with platform schema upgrade" -ForegroundColor Yellow
  }

  Write-Step "Applying platform foundation schema upgrade"
  Invoke-Step @('node', 'scripts/platform-schema-upgrade.js')

  Write-Step "Running doctor"
  Invoke-Step @('npm.cmd', 'run', 'doctor')

  Write-Step "Running security check"
  Invoke-Step @('npm.cmd', 'run', 'security:check')

  Write-Step "Running readiness gate"
  Invoke-Step @('npm.cmd', 'run', 'readiness:full')
}

Write-Step "Platform bootstrap complete"
Write-Host "Next: review docs/GO_LIVE_CHECKLIST_TH.md and docs/SPLIT_ORIGIN_AND_2FA_GUIDE.md, then verify /landing, /showcase, /trial, /admin" -ForegroundColor Green
Write-Host "Profile used: $Profile" -ForegroundColor DarkGray
Write-Host "Optional: npm run security:scaffold-split-env -- --admin-origin https://admin.example.com --player-origin https://player.example.com" -ForegroundColor DarkGray
Write-Host "Optional: npm run security:apply-split-env -- --write" -ForegroundColor DarkGray
Write-Host "Optional: npm run security:activate-split-env -- --admin-origin https://admin.example.com --player-origin https://player.example.com --write --with-readiness" -ForegroundColor DarkGray

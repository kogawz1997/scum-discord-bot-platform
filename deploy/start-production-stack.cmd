@echo off
setlocal

cd /d "%~dp0.."

echo [SCUM] validate security baseline...
call npm run security:check
if errorlevel 1 (
  echo [SCUM] security:check failed
  exit /b 1
)

echo [SCUM] validate topology...
call npm run doctor:topology:prod
if errorlevel 1 (
  echo [SCUM] doctor:topology:prod failed
  exit /b 1
)

echo [SCUM] start production stack...
call pm2 start deploy/pm2.ecosystem.config.cjs --update-env
if errorlevel 1 (
  echo [SCUM] pm2 start failed
  exit /b 1
)

call pm2 status
exit /b 0

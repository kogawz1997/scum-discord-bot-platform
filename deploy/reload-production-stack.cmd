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

echo [SCUM] reload production stack...
call pm2 reload deploy/pm2.ecosystem.config.cjs --update-env
if errorlevel 1 (
  echo [SCUM] pm2 reload failed
  exit /b 1
)

echo [SCUM] readiness check...
call npm run readiness:prod
if errorlevel 1 (
  echo [SCUM] readiness:prod failed
  exit /b 1
)

echo [SCUM] smoke check...
call npm run smoke:postdeploy
if errorlevel 1 (
  echo [SCUM] smoke:postdeploy failed
  exit /b 1
)

call pm2 status
exit /b 0

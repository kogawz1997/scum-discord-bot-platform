@echo off
setlocal

cd /d "%~dp0.."

echo [SCUM] Step 1/7 rotate production secrets + enforce production env...
call node scripts/rotate-production-secrets.js --write %*
if errorlevel 1 (
  echo [SCUM] rotate-production-secrets failed
  exit /b 1
)

echo [SCUM] Step 2/8 validate production secrets/security baseline...
call npm run security:check
if errorlevel 1 (
  echo [SCUM] security:check failed
  exit /b 1
)

echo [SCUM] Step 3/8 validate runtime topology...
call npm run doctor:topology:prod
if errorlevel 1 (
  echo [SCUM] doctor:topology:prod failed
  exit /b 1
)

echo [SCUM] Step 4/8 install dependencies...
call npm install
if errorlevel 1 (
  echo [SCUM] npm install failed
  exit /b 1
)

echo [SCUM] Step 5/8 prisma generate + migrate...
call cmd /c npx prisma generate
if errorlevel 1 (
  echo [SCUM] prisma generate failed
  exit /b 1
)
call cmd /c npx prisma migrate deploy
if errorlevel 1 (
  echo [SCUM] prisma migrate deploy failed
  exit /b 1
)

echo [SCUM] Step 6/8 repair legacy mojibake text in database...
call npm run text:repair
if errorlevel 1 (
  echo [SCUM] text:repair failed
  exit /b 1
)

echo [SCUM] Step 7/8 start split runtime (bot/worker/watcher/web) via PM2...
call pm2 delete scum-bot scum-worker scum-watcher scum-web-portal >nul 2>nul
call pm2 start deploy/pm2.ecosystem.config.cjs --update-env
if errorlevel 1 (
  echo [SCUM] pm2 start failed
  exit /b 1
)

echo [SCUM] Step 8/8 readiness check...
call npm run readiness:prod
if errorlevel 1 (
  echo [SCUM] readiness:prod failed
  exit /b 1
)

echo [SCUM] Post-deploy smoke test...
call npm run smoke:postdeploy
if errorlevel 1 (
  echo [SCUM] smoke:postdeploy failed
  exit /b 1
)

echo [SCUM] Production one-click deploy complete.
call pm2 status
exit /b 0

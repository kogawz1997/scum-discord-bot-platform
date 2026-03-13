@echo off
setlocal

cd /d "%~dp0.."

echo [SCUM] stop production stack...
call pm2 delete scum-bot scum-worker scum-watcher scum-web-portal >nul 2>nul

call pm2 status
exit /b 0

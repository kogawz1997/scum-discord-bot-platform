@echo off
setlocal

set "KEEP_PID=%~1"
if "%KEEP_PID%"=="" set "KEEP_PID=69992"

echo Launching elevated SCUM cleanup...
echo Keep PID: %KEEP_PID%

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cleanup-scum-instance-admin.ps1" -KeepPid %KEEP_PID%

@echo off
setlocal

set "RCON_PORT=%~1"
if "%RCON_PORT%"=="" set "RCON_PORT=8038"
set "SCUM_ROOT=%~2"

if "%SCUM_ROOT%"=="" (
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='Z:\SteamLibrary\steamapps\common\SCUM Server'; $d=Get-PSDrive Z -ErrorAction SilentlyContinue; if ($d -and $d.DisplayRoot) { Join-Path $d.DisplayRoot 'SteamLibrary\steamapps\common\SCUM Server' } else { $p }"`) do set "SCUM_ROOT=%%I"
)

echo Launching elevated SCUM main restart...
echo Expected RCon port: %RCON_PORT%
echo SCUM root: %SCUM_ROOT%

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restart-scum-main-admin.ps1" -ExpectedRconPort %RCON_PORT% -ScumRoot "%SCUM_ROOT%"

@echo off
setlocal enabledelayedexpansion

title Stop Auditor Pro v3.0

echo ====================================================================
echo  Stopping Local Project Performance & API Auditor Pro Server (Port 4890)
echo ====================================================================
echo.

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4890 ^| findstr LISTENING') do (
    set PID=%%a
    set FOUND=1
    echo [*] Terminating process PID !PID! listening on port 4890...
    taskkill /F /PID !PID! >nul 2>nul
    if !errorlevel! equ 0 (
        echo [OK] Server process !PID! stopped successfully.
    ) else (
        echo [!] Could not terminate process !PID! (may require Administrator permissions).
    )
)

if %FOUND% equ 0 (
    echo [*] No Auditor Pro server was found running on port 4890.
)

echo.
echo Done.
timeout /t 3 >nul

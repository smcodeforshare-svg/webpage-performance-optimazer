@echo off
setlocal enabledelayedexpansion

title Local Project Performance & API Auditor Pro v3.0

echo ====================================================================
echo  Local Project Performance & API Auditor Pro — Advanced v3.0
echo  Production-Grade Local-First Performance & Source Analysis Engine
echo ====================================================================
echo.

cd /d "%~dp0"

:: 1. Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please download and install Node.js 18 or newer from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [OK] Node.js runtime detected: !NODE_VERSION!

:: 2. Check for npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in your system PATH!
    echo.
    pause
    exit /b 1
)

:: 3. Check for dependencies
if not exist "node_modules\" (
    echo.
    echo [*] Initial setup: Installing project dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
)

:: 4. Verify Playwright Chromium Browser
echo [*] Checking browser automation binaries...
if exist "node_modules\playwright" (
    call npx playwright install chromium
    if %errorlevel% neq 0 (
        echo [WARNING] Playwright Chromium installation encountered a warning.
        echo Application will operate using built-in synthetic HTTP timing fallback.
    ) else (
        echo [OK] Playwright Chromium is ready.
    )
)

:: 5. Launch local server and open dashboard
echo.
echo [*] Starting local auditor server on http://127.0.0.1:4890 ...
echo [*] Press Ctrl+C in this terminal window to stop the server anytime.
echo.

start "" http://127.0.0.1:4890

node server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server terminated with an error code: %errorlevel%
    pause
    exit /b %errorlevel%
)

pause

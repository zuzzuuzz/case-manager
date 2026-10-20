@echo off
title VelourCare Ortho - Case Report Manager
cd /d "%~dp0"

echo ================================================================
echo   VelourCare Ortho - Case Report Manager
echo ================================================================
echo Starting local clinical server and Cloudflare tunnel...
echo.

python server.py
if errorlevel 1 (
    echo.
    echo Python was not found or exited with an error.
    echo Please make sure Python 3 is installed and added to PATH.
    pause
)

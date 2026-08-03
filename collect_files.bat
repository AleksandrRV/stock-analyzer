@echo off
chcp 65001 > nul

cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
    echo Python not found. Please install Python 3.9+ and add it to PATH.
    pause
    exit /b 1
)

python "%~dp0collect_files.py"

echo.
if errorlevel 1 (
    echo Script finished with error.
) else (
    echo Done! collected_files.txt has been created.
)

echo.
pause

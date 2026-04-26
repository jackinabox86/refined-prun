@echo off
setlocal

echo Building extension...
call pnpm build
if %ERRORLEVEL% neq 0 (
    echo.
    echo Build failed. Fix the errors above and try again.
    pause
    exit /b 1
)

set "EDGE="
if exist "%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe"
if "%EDGE%"=="" if exist "%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe"

if "%EDGE%"=="" (
    echo.
    echo Edge not found. It should be pre-installed on Windows 10/11.
    pause
    exit /b 1
)

for %%I in ("%~dp0..\dist") do set "EXT=%%~fI"
set "PROFILE=%LOCALAPPDATA%\rprun-edge-profile"
del /f /q "%PROFILE%\SingletonLock" 2>nul

echo Opening Edge with extension...
start "" "%EDGE%" --load-extension="%EXT%" --user-data-dir="%PROFILE%" https://apex.prosperousuniverse.com

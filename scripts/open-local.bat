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

set "CHROME="
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if "%CHROME%"=="" if exist "%PROGRAMFILES%\Google\Chrome\Application\chrome.exe" set "CHROME=%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"
if "%CHROME%"=="" if exist "%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe"

if "%CHROME%"=="" (
    echo.
    echo Chrome not found in standard locations.
    echo Set CHROME manually at the top of this script.
    pause
    exit /b 1
)

for %%I in ("%~dp0..\dist") do set "EXT=%%~fI"

echo Opening Chrome with extension...
start "" "%CHROME%" --load-extension="%EXT%" https://apex.prosperousuniverse.com

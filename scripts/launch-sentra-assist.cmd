@echo off
setlocal

set "EXT_DIR=d:\sentrasolutions\assist\.output\chrome-mv3"
set "EPUSKESMAS_URL=https://kotakediri.epuskesmas.id/"
set "PROFILE_DIR=%TEMP%\SentraAssistChromeProfile"

if not exist "%EXT_DIR%\manifest.json" (
  echo [ERROR] Extension build tidak ditemukan di: %EXT_DIR%
  echo Jalankan dulu: pnpm build
  pause
  exit /b 1
)

set "CHROME_EXE="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
  if exist "%%~P" (
    set "CHROME_EXE=%%~P"
    goto :launch
  )
)

for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul ^| find /I "REG_SZ"') do (
  set "CHROME_EXE=%%B"
)
if not defined CHROME_EXE (
  for /f "tokens=2,*" %%A in ('reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul ^| find /I "REG_SZ"') do (
    set "CHROME_EXE=%%B"
  )
)

:launch
if not defined CHROME_EXE (
  echo [ERROR] Google Chrome tidak ditemukan.
  echo Install Chrome dulu, lalu jalankan ulang launcher ini.
  pause
  exit /b 1
)

start "Sentra Assist" "%CHROME_EXE%" --user-data-dir="%PROFILE_DIR%" --load-extension="%EXT_DIR%" "%EPUSKESMAS_URL%"
exit /b 0

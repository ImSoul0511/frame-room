@echo off
setlocal
cd /d "%~dp0.."
where pnpm >nul 2>&1
if errorlevel 1 (
  echo Install pnpm 9.15.0 with npm, then follow README.md.
  exit /b 1
)
for /f "delims=" %%v in ('pnpm --version') do set "PNPM_VERSION=%%v"
if not "%PNPM_VERSION%"=="9.15.0" (
  echo Expected pnpm 9.15.0; found %PNPM_VERSION%. Run npm install --global pnpm@9.15.0.
  exit /b 1
)
call pnpm dev
exit /b %errorlevel%

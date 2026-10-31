@echo off
setlocal
cd /d "%~dp0.."
where corepack >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22 with Corepack, then follow README.md.
  exit /b 1
)
call corepack pnpm dev
exit /b %errorlevel%

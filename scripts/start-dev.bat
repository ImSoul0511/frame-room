@echo off
setlocal EnableExtensions

rem FrameRoom local development launcher (Windows)
set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%"

echo.
echo === FrameRoom development environment ===

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not available in PATH.
  exit /b 1
)

where pnpm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERROR] pnpm.cmd is not available in PATH.
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    echo [INFO] Creating .env from .env.example
    copy /y ".env.example" ".env" >nul
  ) else (
    echo [WARN] .env.example was not found.
  )
)

if not exist "node_modules" (
  echo [INFO] Installing Node dependencies...
  call pnpm.cmd install --frozen-lockfile
  if errorlevel 1 exit /b 1
)

if not exist "apps\ai-service\.venv\Scripts\python.exe" (
  echo [INFO] Creating the AI service virtual environment...
  python -m venv "apps\ai-service\.venv"
  if errorlevel 1 exit /b 1
  echo [INFO] Installing AI service dependencies...
  call "apps\ai-service\.venv\Scripts\python.exe" -m pip install -r "apps\ai-service\requirements.txt"
  if errorlevel 1 exit /b 1
)

where supabase >nul 2>&1
if errorlevel 1 (
  echo [WARN] Supabase CLI was not found. Skipping supabase start.
) else (
  docker info >nul 2>&1
  if errorlevel 1 (
    echo [WARN] Docker is not running. Skipping supabase start.
  ) else (
    echo [INFO] Starting Supabase local services...
    call supabase start
    if errorlevel 1 echo [WARN] Supabase could not be started. Continuing with app services.
  )
)

echo [INFO] Opening API, Web, and AI service consoles...
start "FrameRoom API" cmd /k "cd /d ""%ROOT%"" && pnpm.cmd --filter api dev"
start "FrameRoom Web" cmd /k "cd /d ""%ROOT%"" && pnpm.cmd --filter web dev"
start "FrameRoom AI" cmd /k "cd /d ""%ROOT%\apps\ai-service"" && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001"

echo.
echo Services started:
echo   Web: http://localhost:5173
echo   API: http://localhost:4000/health
echo   AI:  http://localhost:8001/health
echo.
echo Close the three opened consoles to stop the application services.
pause
endlocal

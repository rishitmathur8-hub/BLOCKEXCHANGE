@echo off
echo ===================================================
echo   Block Exchange: Indian Railways Operations Advisory
echo ===================================================
echo.

echo [1/3] Installing backend dependencies...
cd backend
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo Backend dependency installation failed.
    pause
    exit /b %errorlevel%
)

echo [2/3] Seeding initial database...
python seed.py

echo [3/3] Installing frontend dependencies...
cd ..\frontend
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo Frontend dependency installation failed.
    pause
    exit /b %errorlevel%
)

echo.
echo ===================================================
echo Starting Backend (FastAPI :8000) and Frontend (Vite :5173)...
echo ===================================================

start "BlockExchange-Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload --port 8000"
timeout /t 2 /nobreak >nul
start "BlockExchange-Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Application launched!
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo.
pause

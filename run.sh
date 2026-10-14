#!/usr/bin/env bash
set -e

echo "==================================================="
echo "  Block Exchange: Indian Railways Operations Advisory"
echo "==================================================="
echo ""

echo "[1/3] Setting up backend..."
cd backend
pip install -r requirements.txt
python seed.py

echo "[2/3] Setting up frontend..."
cd ../frontend
npm install --legacy-peer-deps

echo "[3/3] Starting servers..."
(cd ../backend && python -m uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!

(cd ../frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "Block Exchange is running:"
echo "Backend:  http://127.0.0.1:8000"
echo "Frontend: http://localhost:5173"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait

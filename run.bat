@echo off
echo Starting Backend...
start cmd /k "uvicorn backend.main:app --reload --port 8000"

echo Starting Frontend...
cd frontend
start cmd /k "npm run dev"

echo App started! Open http://localhost:5173

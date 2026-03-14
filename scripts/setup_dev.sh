#!/usr/bin/env bash
set -e

echo "=== Installing frontend dependencies ==="
cd frontend
npm install
cd ..

echo "=== Installing backend dependencies ==="
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

echo "=== Setup complete ==="
echo ""
echo "To run frontend:  cd frontend && npm run dev"
echo "To run backend:   cd backend && source venv/bin/activate && uvicorn app.main:app --reload"

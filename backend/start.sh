#!/bin/bash
# Project Hailstorm — Backend Start Script
set -e

cd "$(dirname "$0")"

# Install deps if venv doesn't exist yet
if [ ! -d ".venv" ]; then
  echo "🔧 Creating virtual environment..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -q -r requirements.txt
  echo "✅ Dependencies installed."
else
  source .venv/bin/activate
fi

# Verify .env exists
if [ ! -f ".env" ]; then
  echo "⚠️  No .env found. Copying .env.example → .env"
  cp .env.example .env
  echo "   → Fill in SUPABASE_KEY before running again."
  exit 1
fi

echo "🚀 Starting Hailstorm backend on http://0.0.0.0:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

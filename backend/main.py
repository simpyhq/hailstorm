"""
Project Hailstorm — FastAPI Backend
Iron Man-style personal dashboard brain.

Run with: ./start.sh  or  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
import logging
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from chat import router as chat_router
from briefing import router as briefing_router
from history import get_history

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

app = FastAPI(
    title="Project Hailstorm API",
    description="Backend for the Hailstorm Iron Man dashboard",
    version="1.0.0",
)

# CORS — allow all origins (LAN-only deployment, safe)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(chat_router)
app.include_router(briefing_router)


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/history")
async def history(session_id: str = "default", limit: int = 20):
    messages = get_history(session_id, limit=limit)
    return {"messages": messages}

"""
/chat endpoint — proxies user messages to OpenClaw and persists history.
"""
import uuid
import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import OPENCLAW_API_URL
import history as hist

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: str = ""


class ChatResponse(BaseModel):
    reply: str
    session_id: str


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())

    # Save user message (non-blocking, errors suppressed inside hist)
    hist.save_message(session_id, "user", req.message)

    # Proxy to OpenClaw
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{OPENCLAW_API_URL}/api/chat",
                json={"message": req.message, "session_id": session_id},
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data.get("reply") or data.get("message") or str(data)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="OpenClaw API is unreachable. Make sure OpenClaw is running on this machine.",
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="OpenClaw API timed out.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OpenClaw API error: {e.response.status_code}")

    # Save assistant reply
    hist.save_message(session_id, "assistant", reply)

    return ChatResponse(reply=reply, session_id=session_id)

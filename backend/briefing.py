"""
/briefing endpoint — triggers the 60-second Mission Control spoken briefing.
Frontend uses the returned text with OpenAI TTS (Onyx voice).
"""
import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import OPENCLAW_API_URL

logger = logging.getLogger(__name__)
router = APIRouter()

BRIEFING_PROMPT = (
    "Give me a 60-second Mission Control briefing: current weather, market summary, "
    "any urgent emails, and what's on the calendar today. Be concise and direct."
)


class BriefingResponse(BaseModel):
    text: str


@router.post("/briefing", response_model=BriefingResponse)
async def briefing():
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{OPENCLAW_API_URL}/api/chat",
                json={"message": BRIEFING_PROMPT},
            )
            resp.raise_for_status()
            data = resp.json()
            text = data.get("reply") or data.get("message") or str(data)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="OpenClaw API is unreachable. Make sure OpenClaw is running.",
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Briefing request timed out.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OpenClaw API error: {e.response.status_code}")

    return BriefingResponse(text=text)

"""
Supabase chat history helpers.
History is non-critical — errors are logged but never crash the chat endpoint.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


def get_client() -> Optional[Client]:
    global _client
    if _client is None and SUPABASE_URL and SUPABASE_KEY:
        try:
            _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            logger.warning(f"Supabase init failed: {e}")
    return _client


def save_message(session_id: str, role: str, content: str) -> None:
    """Persist a single message to Supabase. Fire-and-forget."""
    client = get_client()
    if not client:
        logger.warning("Supabase unavailable — skipping history save.")
        return
    try:
        client.table("chat_history").insert({
            "session_id": session_id,
            "role": role,
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"Supabase insert failed: {e}")


def get_history(session_id: str, limit: int = 20) -> list[dict]:
    """Return the last `limit` messages for a session, oldest first."""
    client = get_client()
    if not client:
        return []
    try:
        result = (
            client.table("chat_history")
            .select("role, content, created_at")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = result.data or []
        return list(reversed(rows))
    except Exception as e:
        logger.warning(f"Supabase fetch failed: {e}")
        return []

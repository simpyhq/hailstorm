# Hailstorm Backend

FastAPI backend for the Project Hailstorm Iron Man dashboard.

## Prerequisites

- Python 3.11+
- OpenClaw running on the same machine (`openclaw gateway start`)
- Supabase project (free tier works fine)

## Setup

```bash
# 1. Copy env template
cp .env.example .env

# 2. Fill in your Supabase anon key in .env

# 3. Run the schema in Supabase SQL editor (one-time)
#    → Open schema.sql and paste it into Supabase → SQL Editor → Run

# 4. Start the server
./start.sh
```

The script auto-creates a virtual environment and installs dependencies on first run.

## Endpoints

| Method | Path        | Description                                      |
|--------|-------------|--------------------------------------------------|
| GET    | /health     | Health check — confirms server is running        |
| POST   | /chat       | Send a message, get a reply via OpenClaw         |
| POST   | /briefing   | Trigger 60-sec Mission Control spoken briefing   |
| GET    | /history    | Last 20 messages for a session from Supabase     |

### POST /chat

```json
// Request
{ "message": "What's the weather?", "session_id": "optional-uuid" }

// Response
{ "reply": "It's 72°F and sunny in Norman.", "session_id": "uuid-here" }
```

### POST /briefing

```json
// Response
{ "text": "Good morning. Markets are up 0.4%..." }
```

The frontend sends this text to OpenAI TTS (Onyx voice) for playback.

### GET /history

```
GET /history?session_id=my-session&limit=20
```

```json
{
  "messages": [
    { "role": "user", "content": "Hello", "created_at": "2026-05-04T..." },
    { "role": "assistant", "content": "Hey! What's up?", "created_at": "2026-05-04T..." }
  ]
}
```

## Notes

- CORS is wide open (allow all origins) — safe because this only runs on your LAN.
- Supabase history is **non-critical** — if it's unreachable, chat still works fine.
- Default port: **8000**. Vercel frontend should point to `http://192.168.4.33:8000`.

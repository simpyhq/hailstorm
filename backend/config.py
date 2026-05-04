import os
from dotenv import load_dotenv

load_dotenv()

OPENCLAW_API_URL = os.getenv("OPENCLAW_API_URL", "http://localhost:3000")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

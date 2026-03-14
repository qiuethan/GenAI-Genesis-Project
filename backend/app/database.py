import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env from the backend directory (parent of app/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

from app.database import get_supabase


def create_user(email: str) -> dict:
    sb = get_supabase()
    result = sb.table("users").insert({"email": email}).execute()
    return result.data[0]


def create_artist(user_id: str, display_name: str, bio: str = None,
                  avatar_url: str = None, portfolio_url: str = None) -> dict:
    sb = get_supabase()
    row = {
        "user_id": user_id,
        "display_name": display_name,
        "bio": bio,
        "avatar_url": avatar_url,
        "portfolio_url": portfolio_url,
    }
    result = sb.table("artists").insert(row).execute()
    return result.data[0]


def create_default_ai_settings(artist_id: str) -> dict:
    sb = get_supabase()
    row = {
        "artist_id": artist_id,
        "protection_enabled": True,
        "allow_training": False,
        "allow_generation": True,
        "allow_commercial_licensing": False,
    }
    result = sb.table("artist_ai_settings").insert(row).execute()
    return result.data[0]


def get_artist(artist_id: str) -> dict | None:
    sb = get_supabase()
    result = sb.table("artists").select("*").eq("id", artist_id).execute()
    return result.data[0] if result.data else None


def get_ai_settings(artist_id: str) -> dict | None:
    sb = get_supabase()
    result = (
        sb.table("artist_ai_settings")
        .select("*")
        .eq("artist_id", artist_id)
        .execute()
    )
    return result.data[0] if result.data else None


def upsert_ai_settings(artist_id: str, settings: dict) -> dict:
    sb = get_supabase()
    row = {"artist_id": artist_id, **settings}
    result = (
        sb.table("artist_ai_settings")
        .upsert(row, on_conflict="artist_id")
        .execute()
    )
    return result.data[0]

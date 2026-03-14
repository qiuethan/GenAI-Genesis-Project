from app.database import get_supabase


def create_artwork(artist_id: str, title: str, description: str = None,
                   image_url: str = "", protected_image_url: str = None,
                   is_public: bool = True) -> dict:
    sb = get_supabase()
    row = {
        "artist_id": artist_id,
        "title": title,
        "description": description,
        "image_url": image_url,
        "protected_image_url": protected_image_url,
        "is_public": is_public,
    }
    result = sb.table("artworks").insert(row).execute()
    return result.data[0]


def get_artworks_by_artist(artist_id: str) -> list[dict]:
    sb = get_supabase()
    result = (
        sb.table("artworks")
        .select("*")
        .eq("artist_id", artist_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data

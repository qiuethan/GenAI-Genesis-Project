import logging
import time

from app.database import get_supabase
from app.services.glaze_service import glaze_image_bytes
from app.services.watermark_service import embed_watermark

log = logging.getLogger(__name__)


def upload_and_create_artwork(
    artist_id: str,
    title: str,
    file_bytes: bytes,
    file_ext: str,
    description: str | None = None,
    is_public: bool = True,
) -> dict:
    sb = get_supabase()
    path = f"{artist_id}/{int(time.time())}_{title}.{file_ext}"

    # 1. Glaze the image to protect against AI style mimicry
    public_bytes = glaze_image_bytes(file_bytes, filename=f"artwork.{file_ext}")

    # 2. Embed invisible watermark for provenance tracking
    public_bytes, wm_length = embed_watermark(public_bytes, artist_id, file_ext)

    # 3. Upload original to private bucket, glazed+watermarked to public bucket
    sb.storage.from_("artworks-raw").upload(path, file_bytes)
    sb.storage.from_("artworks-public").upload(path, public_bytes)

    # Get public URL for display
    pub_url = sb.storage.from_("artworks-public").get_public_url(path)

    # Create artwork record
    row = {
        "artist_id": artist_id,
        "title": title,
        "description": description,
        "image_url": pub_url,
        "protected_image_url": path,
        "is_public": is_public,
        "wm_length": wm_length,
    }
    result = sb.table("artworks").insert(row).execute()
    return result.data[0]


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

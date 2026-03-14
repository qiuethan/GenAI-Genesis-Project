from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.artworks import ArtworkCreate, ArtworkOut
from app.services import artworks as artwork_svc
from app.services.watermark_service import extract_watermark
from app.database import get_supabase

router = APIRouter()


@router.post("/", response_model=ArtworkOut)
def create_artwork(body: ArtworkCreate):
    return artwork_svc.create_artwork(
        artist_id=body.artist_id,
        title=body.title,
        description=body.description,
        image_url=body.image_url,
        protected_image_url=body.protected_image_url,
        is_public=body.is_public,
    )


@router.post("/upload", response_model=ArtworkOut)
async def upload_artwork(
    artist_id: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    is_public: bool = Form(True),
    file: UploadFile = File(...),
):
    file_bytes = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if file.filename else "png"
    return artwork_svc.upload_and_create_artwork(
        artist_id=artist_id,
        title=title,
        file_bytes=file_bytes,
        file_ext=ext,
        description=description or None,
        is_public=is_public,
    )


@router.post("/{artwork_id}/verify-watermark")
async def verify_watermark(
    artwork_id: str,
    file: UploadFile = File(...),
):
    """
    Upload an image and check if it contains this artwork's watermark.
    Returns the extracted watermark text and whether it matches the artist.
    """
    sb = get_supabase()
    result = sb.table("artworks").select("artist_id, wm_length").eq("id", artwork_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Artwork not found")

    artwork = result.data[0]
    wm_length = artwork.get("wm_length")
    if not wm_length:
        raise HTTPException(status_code=400, detail="Artwork has no watermark")

    file_bytes = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if file.filename else "png"

    try:
        extracted = extract_watermark(file_bytes, wm_length, ext)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not extract watermark from image")

    return {
        "artwork_id": artwork_id,
        "expected_artist_id": artwork["artist_id"],
        "extracted_watermark": extracted,
        "match": extracted == artwork["artist_id"],
    }

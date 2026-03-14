from fastapi import APIRouter

from app.schemas.artworks import ArtworkCreate, ArtworkOut
from app.services import artworks as artwork_svc

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

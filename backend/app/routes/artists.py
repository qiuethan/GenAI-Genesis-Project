from fastapi import APIRouter, HTTPException

from app.schemas.artists import ArtistCreate, ArtistCreateOut, AISettingsUpdate, AISettingsOut
from app.schemas.artworks import ArtworkOut
from app.schemas.earnings import EarningOut, EarningsSummaryOut
from app.services import artists as artist_svc
from app.services import artworks as artwork_svc
from app.services import earnings as earn_svc

router = APIRouter()


@router.post("/", response_model=ArtistCreateOut)
def create_artist(body: ArtistCreate):
    user = artist_svc.create_user(body.email)
    artist = artist_svc.create_artist(
        user_id=user["id"],
        display_name=body.display_name,
        bio=body.bio,
        avatar_url=body.avatar_url,
        portfolio_url=body.portfolio_url,
    )
    ai_settings = artist_svc.create_default_ai_settings(artist["id"])
    return {"user": user, "artist": artist, "ai_settings": ai_settings}


@router.get("/{artist_id}")
def get_artist(artist_id: str):
    artist = artist_svc.get_artist(artist_id)
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    return artist


@router.post("/{artist_id}/ai-settings", response_model=AISettingsOut)
def upsert_ai_settings(artist_id: str, body: AISettingsUpdate):
    return artist_svc.upsert_ai_settings(artist_id, body.model_dump())


@router.get("/{artist_id}/ai-settings", response_model=AISettingsOut)
def get_ai_settings(artist_id: str):
    settings = artist_svc.get_ai_settings(artist_id)
    if not settings:
        raise HTTPException(status_code=404, detail="AI settings not found")
    return settings


@router.get("/{artist_id}/artworks", response_model=list[ArtworkOut])
def get_artist_artworks(artist_id: str):
    return artwork_svc.get_artworks_by_artist(artist_id)


@router.get("/{artist_id}/earnings", response_model=list[EarningOut])
def get_artist_earnings(artist_id: str):
    return earn_svc.get_earnings(artist_id)


@router.get("/{artist_id}/earnings-summary", response_model=EarningsSummaryOut)
def get_artist_earnings_summary(artist_id: str):
    return earn_svc.get_earnings_summary(artist_id)

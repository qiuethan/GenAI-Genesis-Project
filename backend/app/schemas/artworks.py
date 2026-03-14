from pydantic import BaseModel
from typing import Optional


class ArtworkCreate(BaseModel):
    artist_id: str
    title: str
    description: Optional[str] = None
    image_url: str
    protected_image_url: Optional[str] = None
    is_public: bool = True


class ArtworkOut(BaseModel):
    id: str
    artist_id: str
    title: str
    description: Optional[str] = None
    image_url: str
    protected_image_url: Optional[str] = None
    is_public: bool
    wm_length: Optional[int] = None
    created_at: str

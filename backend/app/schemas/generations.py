from pydantic import BaseModel
from typing import Optional, List


class SelectedArtist(BaseModel):
    artist_id: str
    weight: float = 1.0


class GenerationCreate(BaseModel):
    user_id: str
    prompt: str
    license_type: str = "personal"
    total_price: float = 0.0
    artist_pool_amount: float = 0.0
    selected_artists: Optional[List[SelectedArtist]] = None


class GenerationOut(BaseModel):
    id: str
    user_id: str
    prompt: str
    output_url: Optional[str] = None
    status: str
    license_type: str
    total_price: float
    artist_pool_amount: float
    created_at: str


class GenerationDetailOut(GenerationOut):
    selected_artists: List[dict] = []

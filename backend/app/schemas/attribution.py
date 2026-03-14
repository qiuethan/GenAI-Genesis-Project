from pydantic import BaseModel
from typing import List, Optional


class AttributionResultOut(BaseModel):
    id: str
    generation_id: str
    artist_id: str
    contribution_score: float
    royalty_amount: float
    created_at: str


class AttributionResponse(BaseModel):
    generation_id: str
    results: List[AttributionResultOut]

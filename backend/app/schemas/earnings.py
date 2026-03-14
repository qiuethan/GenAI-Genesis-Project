from pydantic import BaseModel
from typing import List


class EarningOut(BaseModel):
    id: str
    artist_id: str
    amount: float
    source_type: str
    source_id: str
    created_at: str


class EarningsSummaryOut(BaseModel):
    total_earned: float
    generation_earned: float
    license_earned: float
    recent: List[EarningOut]

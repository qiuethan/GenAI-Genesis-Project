from fastapi import APIRouter

from app.schemas.earnings import EarningOut, EarningsSummaryOut
from app.services import earnings as earn_svc

router = APIRouter()


@router.get("/{artist_id}", response_model=list[EarningOut])
def get_earnings(artist_id: str):
    return earn_svc.get_earnings(artist_id)


@router.get("/{artist_id}/summary", response_model=EarningsSummaryOut)
def get_earnings_summary(artist_id: str):
    return earn_svc.get_earnings_summary(artist_id)

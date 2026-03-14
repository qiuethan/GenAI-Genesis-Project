from fastapi import APIRouter

from app.schemas.attribution import AttributionResponse
from app.services import attribution as attr_svc

router = APIRouter()


@router.post("/{generation_id}", response_model=AttributionResponse)
def run_attribution(generation_id: str):
    results = attr_svc.run_attribution(generation_id)
    return {"generation_id": generation_id, "results": results}


@router.get("/{generation_id}", response_model=AttributionResponse)
def get_attribution(generation_id: str):
    results = attr_svc.get_attribution(generation_id)
    return {"generation_id": generation_id, "results": results}

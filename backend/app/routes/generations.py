from fastapi import APIRouter, HTTPException

from app.schemas.generations import GenerationCreate, GenerationOut, GenerationDetailOut
from app.schemas.attribution import AttributionResponse
from app.services import generations as gen_svc
from app.services import attribution as attr_svc

router = APIRouter()


@router.post("/", response_model=GenerationOut)
def create_generation(body: GenerationCreate):
    selected = None
    if body.selected_artists:
        selected = [sa.model_dump() for sa in body.selected_artists]
    return gen_svc.create_generation(
        user_id=body.user_id,
        prompt=body.prompt,
        license_type=body.license_type,
        total_price=body.total_price,
        artist_pool_amount=body.artist_pool_amount,
        selected_artists=selected,
    )


@router.get("/{generation_id}", response_model=GenerationDetailOut)
def get_generation(generation_id: str):
    gen = gen_svc.get_generation(generation_id)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    return gen


@router.post("/{generation_id}/attribution", response_model=AttributionResponse)
def run_attribution(generation_id: str):
    results = attr_svc.run_attribution(generation_id)
    return {"generation_id": generation_id, "results": results}


@router.get("/{generation_id}/attribution", response_model=AttributionResponse)
def get_attribution(generation_id: str):
    results = attr_svc.get_attribution(generation_id)
    return {"generation_id": generation_id, "results": results}

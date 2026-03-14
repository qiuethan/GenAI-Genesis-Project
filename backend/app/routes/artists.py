from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def get_artists():
    return {"message": "artists endpoint"}

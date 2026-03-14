from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def get_artworks():
    return {"message": "artworks endpoint"}

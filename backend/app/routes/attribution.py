from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def get_attribution():
    return {"message": "attribution endpoint"}

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def get_generations():
    return {"message": "generations endpoint"}

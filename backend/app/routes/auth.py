"""Auth routes — expose the authenticated user's info."""

from fastapi import APIRouter, Depends
from app.auth import get_current_user

router = APIRouter()


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """Return the current user's JWT claims."""
    return {
        "id": user.get("sub"),
        "email": user.get("email"),
        "role": user.get("role"),
    }

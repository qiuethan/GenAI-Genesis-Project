from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# --- Request schemas ---

class ArtistCreate(BaseModel):
    email: str
    display_name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    portfolio_url: Optional[str] = None


class AISettingsUpdate(BaseModel):
    protection_enabled: bool = True
    allow_training: bool = False
    allow_generation: bool = True
    allow_commercial_licensing: bool = False


# --- Response schemas ---

class UserOut(BaseModel):
    id: str
    email: str
    created_at: str


class ArtistOut(BaseModel):
    id: str
    user_id: str
    display_name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    created_at: str


class ArtistCreateOut(BaseModel):
    user: UserOut
    artist: ArtistOut
    ai_settings: dict


class AISettingsOut(BaseModel):
    id: str
    artist_id: str
    protection_enabled: bool
    allow_training: bool
    allow_generation: bool
    allow_commercial_licensing: bool
    updated_at: str

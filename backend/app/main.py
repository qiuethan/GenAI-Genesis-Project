from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import artists, artworks, generations, auth

app = FastAPI(title="GenAI Genesis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(artists.router, prefix="/api/artists", tags=["artists"])
app.include_router(artworks.router, prefix="/api/artworks", tags=["artworks"])
app.include_router(generations.router, prefix="/api/generations", tags=["generations"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


@app.get("/")
def root():
    return {"status": "backend running"}

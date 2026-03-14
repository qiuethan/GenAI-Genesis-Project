from app.database import get_supabase


def create_generation(user_id: str, prompt: str, license_type: str = "personal",
                      total_price: float = 0.0, artist_pool_amount: float = 0.0,
                      selected_artists: list[dict] | None = None) -> dict:
    sb = get_supabase()
    row = {
        "user_id": user_id,
        "prompt": prompt,
        "status": "pending",
        "license_type": license_type,
        "total_price": total_price,
        "artist_pool_amount": artist_pool_amount,
    }
    result = sb.table("generations").insert(row).execute()
    generation = result.data[0]

    if selected_artists:
        sa_rows = [
            {
                "generation_id": generation["id"],
                "artist_id": sa["artist_id"],
                "weight": sa.get("weight", 1.0),
            }
            for sa in selected_artists
        ]
        sb.table("generation_selected_artists").insert(sa_rows).execute()

    return generation


def get_generation(generation_id: str) -> dict | None:
    sb = get_supabase()
    result = (
        sb.table("generations")
        .select("*")
        .eq("id", generation_id)
        .execute()
    )
    if not result.data:
        return None

    gen = result.data[0]

    sa_result = (
        sb.table("generation_selected_artists")
        .select("*")
        .eq("generation_id", generation_id)
        .execute()
    )
    gen["selected_artists"] = sa_result.data
    return gen

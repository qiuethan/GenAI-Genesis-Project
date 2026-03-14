from app.database import get_supabase


def run_attribution(generation_id: str) -> list[dict]:
    """Stub attribution: assigns mock contribution scores to selected artists
    and distributes the artist_pool_amount proportionally."""
    sb = get_supabase()

    # Get the generation
    gen_result = (
        sb.table("generations").select("*").eq("id", generation_id).execute()
    )
    if not gen_result.data:
        return []
    generation = gen_result.data[0]

    # Get selected artists
    sa_result = (
        sb.table("generation_selected_artists")
        .select("*")
        .eq("generation_id", generation_id)
        .execute()
    )
    selected = sa_result.data
    if not selected:
        return []

    # Compute mock scores: normalize weights into contribution scores
    total_weight = sum(sa["weight"] for sa in selected) or 1.0
    pool = generation.get("artist_pool_amount", 0.0) or 0.0

    attribution_rows = []
    earning_rows = []

    for sa in selected:
        score = sa["weight"] / total_weight
        royalty = round(score * pool, 2)

        attribution_rows.append({
            "generation_id": generation_id,
            "artist_id": sa["artist_id"],
            "contribution_score": round(score, 4),
            "royalty_amount": royalty,
        })

        earning_rows.append({
            "artist_id": sa["artist_id"],
            "amount": royalty,
            "source_type": "generation",
            "source_id": generation_id,
        })

    # Insert attribution results
    attr_result = (
        sb.table("attribution_results").insert(attribution_rows).execute()
    )

    # Insert earnings
    if earning_rows:
        sb.table("artist_earnings").insert(earning_rows).execute()

    return attr_result.data


def get_attribution(generation_id: str) -> list[dict]:
    sb = get_supabase()
    result = (
        sb.table("attribution_results")
        .select("*")
        .eq("generation_id", generation_id)
        .execute()
    )
    return result.data

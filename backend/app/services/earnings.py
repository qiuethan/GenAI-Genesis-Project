from app.database import get_supabase


def get_earnings(artist_id: str) -> list[dict]:
    sb = get_supabase()
    result = (
        sb.table("artist_earnings")
        .select("*")
        .eq("artist_id", artist_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def get_earnings_summary(artist_id: str) -> dict:
    earnings = get_earnings(artist_id)

    total_earned = sum(e["amount"] for e in earnings)
    generation_earned = sum(
        e["amount"] for e in earnings if e["source_type"] == "generation"
    )
    license_earned = sum(
        e["amount"] for e in earnings if e["source_type"] == "license"
    )

    return {
        "total_earned": round(total_earned, 2),
        "generation_earned": round(generation_earned, 2),
        "license_earned": round(license_earned, 2),
        "recent": earnings[:10],
    }

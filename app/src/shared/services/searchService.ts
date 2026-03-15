import { supabase } from '../../infra/supabase/client';

export interface SearchUserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  composition_badge: string | null;
  follower_count: number;
  following_count: number;
}

const SEARCH_LIMIT = 25;

/**
 * Search user_profiles by username or display_name (case-insensitive partial match).
 * Excludes the given userId (e.g. current user).
 */
export async function searchUsers(
  query: string,
  excludeUserId?: string
): Promise<SearchUserRow[]> {
  const q = (query || '').trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
  if (q.length === 0) return [];

  let req = supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, composition_badge, follower_count, following_count')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(SEARCH_LIMIT);

  if (excludeUserId) {
    req = req.neq('id', excludeUserId);
  }

  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []) as SearchUserRow[];
}

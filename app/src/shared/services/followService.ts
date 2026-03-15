import { supabase } from '../../infra/supabase/client';

export interface FollowProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  composition_badge: string | null;
  follower_count?: number;
  following_count?: number;
}

export async function followUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/** List profiles of users who follow the given userId. */
export async function getFollowers(userId: string): Promise<FollowProfileRow[]> {
  const { data: rows, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId);

  if (error) throw error;
  const ids = (rows ?? []).map((r: { follower_id: string }) => r.follower_id);
  if (ids.length === 0) return [];

  const { data: profiles, error: err2 } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, composition_badge, follower_count, following_count')
    .in('id', ids);

  if (err2) throw err2;
  return (profiles ?? []) as FollowProfileRow[];
}

/** List profiles of users that the given userId follows. */
export async function getFollowing(userId: string): Promise<FollowProfileRow[]> {
  const { data: rows, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (error) throw error;
  const ids = (rows ?? []).map((r: { following_id: string }) => r.following_id);
  if (ids.length === 0) return [];

  const { data: profiles, error: err2 } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, composition_badge, follower_count, following_count')
    .in('id', ids);

  if (err2) throw err2;
  return (profiles ?? []) as FollowProfileRow[];
}

import { supabase } from '../../infra/supabase/client';

export async function savePost(userId: string, submissionId: string) {
  const { error } = await supabase
    .from('saved_posts')
    .insert({ user_id: userId, submission_id: submissionId });
  if (error) throw error;
}

export async function unsavePost(userId: string, submissionId: string) {
  const { error } = await supabase
    .from('saved_posts')
    .delete()
    .eq('user_id', userId)
    .eq('submission_id', submissionId);
  if (error) throw error;
}

export async function isPostSaved(userId: string, submissionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_posts')
    .select('user_id')
    .eq('user_id', userId)
    .eq('submission_id', submissionId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function getSavedPosts(userId: string) {
  const { data, error } = await supabase
    .from('saved_posts')
    .select(`
      submission:submissions!submission_id (
        *,
        user:user_profiles!user_id (username, display_name, avatar_url, composition_badge),
        challenge:challenges!challenge_id (title)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r: any) => r.submission);
}

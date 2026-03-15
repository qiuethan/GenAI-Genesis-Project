import { supabase } from '../../infra/supabase/client';

export async function toggleReaction(submissionId: string, userId: string, currentlyReacted: boolean) {
  if (currentlyReacted) {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('submission_id', submissionId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase
      .from('reactions')
      .insert({ submission_id: submissionId, user_id: userId });
    if (error) throw error;
    return true;
  }
}

export async function getReactionCounts(submissionIds: string[], userId: string) {
  const { data: counts, error: countsError } = await supabase
    .from('reactions')
    .select('submission_id')
    .in('submission_id', submissionIds);

  const { data: userReactions, error: userError } = await supabase
    .from('reactions')
    .select('submission_id')
    .eq('user_id', userId)
    .in('submission_id', submissionIds);

  if (countsError || userError) throw countsError || userError;

  const countMap: Record<string, number> = {};
  for (const r of counts ?? []) {
    countMap[r.submission_id] = (countMap[r.submission_id] || 0) + 1;
  }

  const userReactedSet = new Set((userReactions ?? []).map((r) => r.submission_id));

  return { countMap, userReactedSet };
}

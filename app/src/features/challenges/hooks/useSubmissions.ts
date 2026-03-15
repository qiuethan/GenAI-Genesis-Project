import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../infra/supabase/client';
import { getReactionCounts } from '../../../shared/services/reactionService';
import type { Submission, FeedItem } from '../../../shared/types/database';

export function useChallengeSubmissions(challengeId: string | undefined, currentUserId?: string) {
  const [submissions, setSubmissions] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!challengeId) return;
    setLoading(true);

    // Fetch submissions only (no join) so we never drop rows due to missing profile or score
    const { data: submissionRows, error: subError } = await supabase
      .from('submissions')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('submitted_at', { ascending: false });

    if (subError) {
      __DEV__ && console.warn('[useChallengeSubmissions]', subError.message, subError.details);
      setLoading(false);
      return;
    }

    const rows = (submissionRows ?? []) as any[];
    if (rows.length === 0) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, composition_badge')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [p.id, p])
    );
    const fallbackUser = {
      username: 'User',
      display_name: null as string | null,
      avatar_url: null as string | null,
      composition_badge: null as string | null,
    };
    const { data: challengeRow } = await supabase.from('challenges').select('title').eq('id', challengeId).maybeSingle();
    const challengeTitle = challengeRow?.title ?? '';

    const submissionIds = rows.map((r) => r.id);
    let countMap: Record<string, number> = {};
    let userReactedSet = new Set<string>();
    if (currentUserId) {
      try {
        const reactionData = await getReactionCounts(submissionIds, currentUserId);
        countMap = reactionData.countMap;
        userReactedSet = reactionData.userReactedSet;
      } catch {
        // ignore
      }
    }

    const mapped: FeedItem[] = rows.map((row) => ({
      ...row,
      user: profileMap.get(row.user_id) ?? fallbackUser,
      challenge_title: challengeTitle,
      reaction_count: countMap[row.id] ?? 0,
      comment_count: 0,
      user_has_reacted: userReactedSet.has(row.id),
    }));
    setSubmissions(mapped);
    setLoading(false);
  }, [challengeId, currentUserId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { submissions, loading, refetch: fetch };
}

export function useGlobalFeed(limit = 50, currentUserId?: string) {
  const [submissions, setSubmissions] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);

    // Fetch submissions without joins so rows aren't dropped due to missing profile/challenge
    const { data: submissionRows, error: subError } = await supabase
      .from('submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (subError) {
      __DEV__ && console.warn('[useGlobalFeed]', subError.message, subError.details);
      setLoading(false);
      return;
    }

    const rows = (submissionRows ?? []) as any[];
    if (rows.length === 0) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, composition_badge')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [p.id, p])
    );
    const fallbackUser = {
      username: 'User',
      display_name: null as string | null,
      avatar_url: null as string | null,
      composition_badge: null as string | null,
    };

    const challengeIds = [...new Set(rows.map((r) => r.challenge_id))];
    const { data: challenges } = await supabase
      .from('challenges')
      .select('id, title')
      .in('id', challengeIds);

    const challengeMap = new Map(
      (challenges ?? []).map((c: any) => [c.id, c.title])
    );

    const submissionIds = rows.map((r) => r.id);
    let countMap: Record<string, number> = {};
    let userReactedSet = new Set<string>();
    if (currentUserId && submissionIds.length > 0) {
      try {
        const reactionData = await getReactionCounts(submissionIds, currentUserId);
        countMap = reactionData.countMap;
        userReactedSet = reactionData.userReactedSet;
      } catch {
        // ignore
      }
    }

    const mapped: FeedItem[] = rows.map((row) => ({
      ...row,
      user: profileMap.get(row.user_id) ?? fallbackUser,
      challenge_title: challengeMap.get(row.challenge_id) ?? '',
      reaction_count: countMap[row.id] ?? 0,
      comment_count: 0,
      user_has_reacted: userReactedSet.has(row.id),
    }));
    setSubmissions(mapped);
    setLoading(false);
  }, [limit, currentUserId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { submissions, loading, refetch: fetch };
}

export function useUserSubmission(challengeId: string | undefined, userId: string | undefined) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!challengeId || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error) setSubmission(data as Submission | null);
    setLoading(false);
  }, [challengeId, userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { submission, loading, refetch: fetch };
}

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../infra/supabase/client';
import type { UserProfile, Submission } from '../types/database';

export function useUserProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) setProfile(data as UserProfile);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { profile, loading, refetch: fetch };
}

export function useUserSubmissions(userId: string | undefined) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (!error && data) setSubmissions(data as Submission[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { submissions, loading, refetch: fetch };
}

export function useUserChallengeHistory(userId: string | undefined) {
  const [entries, setEntries] = useState<(Submission & { challenge_title: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        challenge:challenges!challenge_id (title)
      `)
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (!error && data) {
      setEntries(
        (data as any[]).map((row) => ({
          ...row,
          challenge_title: row.challenge?.title ?? '',
        }))
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { entries, loading, refetch: fetch };
}

export function useUserPodiums(userId: string | undefined) {
  const [podiums, setPodiums] = useState<(Submission & { challenge_title: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        challenge:challenges!challenge_id (title)
      `)
      .eq('user_id', userId)
      .lte('rank', 3)
      .not('rank', 'is', null)
      .order('rank', { ascending: true });

    if (!error && data) {
      setPodiums(
        (data as any[]).map((row) => ({
          ...row,
          challenge_title: row.challenge?.title ?? '',
        }))
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { podiums, loading, refetch: fetch };
}

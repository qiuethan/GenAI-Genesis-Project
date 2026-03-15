import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../infra/supabase/client';
import type { Challenge } from '../../../shared/types/database';

export function useActiveChallenge(compositionFilter?: string) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('challenges')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('starts_at', { ascending: false })
      .limit(1);
    if (compositionFilter) {
      query = query.eq('composition_type', compositionFilter);
    }
    const { data, error } = await query.maybeSingle();

    if (!error && data) setChallenge(data as Challenge);
    else setChallenge(null);
    setLoading(false);
  }, [compositionFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  return { challenge, loading, refetch: fetch };
}

export function useUpcomingChallenges(limit = 3, compositionFilter?: string) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('challenges')
      .select('*')
      .eq('status', 'SCHEDULED')
      .order('starts_at', { ascending: true })
      .limit(limit);
    if (compositionFilter) {
      query = query.eq('composition_type', compositionFilter);
    }
    const { data, error } = await query;

    if (!error && data) setChallenges(data as Challenge[]);
    else setChallenges([]);
    setLoading(false);
  }, [limit, compositionFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  return { challenges, loading, refetch: fetch };
}

export function useChallengeDetail(challengeId: string) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (!error && data) setChallenge(data as Challenge);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { challenge, loading, refetch: fetch };
}

export function useChallengeArchive(compositionFilter?: string) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('challenges')
      .select('*')
      .in('status', ['CLOSED', 'ARCHIVED'])
      .order('submissions_close_at', { ascending: false });

    if (compositionFilter) {
      query = query.eq('composition_type', compositionFilter);
    }

    const { data, error } = await query;
    if (!error && data) setChallenges(data as Challenge[]);
    else setChallenges([]);
    setLoading(false);
  }, [compositionFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  return { challenges, loading, refetch: fetch };
}

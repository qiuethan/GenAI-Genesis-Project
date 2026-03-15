import { supabase } from '../../infra/supabase/client';
import { COMPOSITION_LABELS } from '../types/database';
import type { CompositionType } from '../types/database';

const BADGE_THRESHOLD = 3;

export async function computeAndAwardBadge(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('composition_type, rank')
    .eq('user_id', userId)
    .lte('rank', 10)
    .not('rank', 'is', null);

  if (error || !data || data.length === 0) return null;

  const counts: Partial<Record<CompositionType, number>> = {};
  for (const row of data) {
    const type = row.composition_type as CompositionType;
    counts[type] = (counts[type] ?? 0) + 1;
  }

  let bestType: CompositionType | null = null;
  let bestCount = 0;
  for (const [type, count] of Object.entries(counts)) {
    if (count! >= BADGE_THRESHOLD && count! > bestCount) {
      bestType = type as CompositionType;
      bestCount = count!;
    }
  }

  if (!bestType) return null;

  const badgeLabel = COMPOSITION_LABELS[bestType];

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ composition_badge: badgeLabel })
    .eq('id', userId);

  if (updateError) {
    console.warn('Failed to award badge:', updateError.message);
    return null;
  }

  return badgeLabel;
}

export async function getUserBadge(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('composition_badge')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data?.composition_badge ?? null;
}

import * as ImageManipulator from 'expo-image-manipulator';
import { supabase, SUPABASE_URL } from '../../../infra/supabase/client';
import { getServerUrl } from '../../../infra/network/serverUrl';
import type { CompositionType } from '../../../shared/types/database';

interface SubmitPhotoParams {
  challengeId: string;
  userId: string;
  photoUri: string;
  compositionType: CompositionType;
  caption?: string;
}

async function uploadPhoto(userId: string, photoUri: string): Promise<{ url: string; path: string }> {
  const fileName = `${userId}/${Date.now()}.jpg`;

  // Use FormData with the file URI — the reliable way to upload in React Native.
  // RN's FormData handles reading and streaming the file bytes natively.
  const formData = new FormData();
  formData.append('file', {
    uri: photoUri,
    name: fileName,
    type: 'image/jpeg',
  } as any);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/submissions/${fileName}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Upload failed');
  }

  const { data: urlData } = supabase.storage
    .from('submissions')
    .getPublicUrl(fileName);

  return { url: urlData.publicUrl, path: fileName };
}

/**
 * Score a photo via the local ML server.
 * Returns a 0–1 combined score and raw metadata, or null if scoring fails.
 */
async function scoreViaServer(photoUri: string): Promise<{
  score: number;
  metadata: Record<string, unknown>;
} | null> {
  try {
    const processed = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 480 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
    );

    const blob = await fetch(processed.uri).then(r => r.blob());
    const response = await fetch(`${getServerUrl()}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });

    if (!response.ok) return null;
    const data = await response.json();

    const aesthetic = data.aesthetic_score ?? data.score;
    if (aesthetic == null) return null;

    const composition = data.composition_score;

    // Sigmoid normalization matching useGalleryScores logic
    const normA = 1 / (1 + Math.exp(-0.25 * (aesthetic - 45)));
    const normC = composition != null
      ? 1 / (1 + Math.exp(-0.12 * (composition - 50)))
      : null;

    let combined: number;
    if (normC != null) {
      const hi = Math.max(normA, normC);
      const lo = Math.min(normA, normC);
      combined = 0.7 * hi + 0.3 * lo;
    } else {
      combined = normA;
    }

    return {
      score: Math.max(0, Math.min(1, combined)),
      metadata: {
        aesthetic_score: aesthetic,
        composition_score: composition ?? null,
        composition_type: data.composition_type ?? null,
        attributes: data.attributes ?? {},
        inference_ms: data.inference_ms,
      },
    };
  } catch (e) {
    console.warn('[scoreViaServer]', e);
    return null;
  }
}

async function deletePhoto(storagePath: string) {
  const { error } = await supabase.storage
    .from('submissions')
    .remove([storagePath]);
  if (error) console.warn('Failed to delete old photo:', error.message);
}

export async function submitPhoto(params: SubmitPhotoParams) {
  const { challengeId, userId, photoUri, compositionType, caption } = params;

  // Score the photo and upload in parallel
  const [scoreResult, uploaded] = await Promise.all([
    scoreViaServer(photoUri),
    uploadPhoto(userId, photoUri),
  ]);

  const { url, path } = uploaded;

  const { data, error } = await supabase
    .from('submissions')
    .upsert(
      {
        challenge_id: challengeId,
        user_id: userId,
        photo_url: url,
        photo_storage_path: path,
        composition_type: compositionType,
        caption: caption || null,
        score: scoreResult?.score ?? null,
        score_metadata: scoreResult?.metadata ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'challenge_id,user_id' }
    )
    .select()
    .single();

  if (error) throw error;

  try {
    await supabase.rpc('increment_submission_count', { cid: challengeId });
  } catch {
    // Best-effort: server trigger handles count if RPC doesn't exist
  }

  return data;
}

export async function replaceSubmission(params: SubmitPhotoParams & { oldStoragePath: string }) {
  const { oldStoragePath, ...submitParams } = params;

  await deletePhoto(oldStoragePath);

  return submitPhoto(submitParams);
}

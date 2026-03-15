import { supabase, SUPABASE_URL } from '../../../infra/supabase/client';
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

async function deletePhoto(storagePath: string) {
  const { error } = await supabase.storage
    .from('submissions')
    .remove([storagePath]);
  if (error) console.warn('Failed to delete old photo:', error.message);
}

export async function submitPhoto(params: SubmitPhotoParams) {
  const { challengeId, userId, photoUri, compositionType, caption } = params;

  const { url, path } = await uploadPhoto(userId, photoUri);

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

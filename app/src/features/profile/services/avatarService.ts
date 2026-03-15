import { supabase, SUPABASE_URL } from '../../../infra/supabase/client';

/**
 * Upload or replace a user's avatar image.
 * Returns the public URL of the uploaded avatar.
 */
export async function uploadAvatar(userId: string, photoUri: string): Promise<string> {
  const fileName = `${userId}/${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append('file', {
    uri: photoUri,
    name: fileName,
    type: 'image/jpeg',
  } as any);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`,
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
    throw new Error(err.message || 'Avatar upload failed');
  }

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Delete old avatar files for a user (all files in their folder).
 */
export async function deleteOldAvatars(userId: string) {
  const { data: files } = await supabase.storage
    .from('avatars')
    .list(userId);

  if (files && files.length > 0) {
    const paths = files.map((f) => `${userId}/${f.name}`);
    await supabase.storage.from('avatars').remove(paths);
  }
}

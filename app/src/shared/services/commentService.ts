import { supabase } from '../../infra/supabase/client';
import type { Comment, UserProfile } from '../types/database';

export interface CommentWithUser extends Comment {
  user: Pick<UserProfile, 'username' | 'display_name' | 'avatar_url'>;
  replies?: CommentWithUser[];
}

export async function fetchComments(submissionId: string): Promise<CommentWithUser[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      user:user_profiles!user_id (username, display_name, avatar_url)
    `)
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const comments = (data ?? []) as CommentWithUser[];
  return buildCommentTree(comments);
}

function buildCommentTree(flat: CommentWithUser[]): CommentWithUser[] {
  const map = new Map<string, CommentWithUser>();
  const roots: CommentWithUser[] = [];

  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parent_comment_id && map.has(c.parent_comment_id)) {
      map.get(c.parent_comment_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function addComment(
  submissionId: string,
  userId: string,
  body: string,
  parentCommentId?: string
) {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      submission_id: submissionId,
      user_id: userId,
      body,
      parent_comment_id: parentCommentId ?? null,
    })
    .select(`
      *,
      user:user_profiles!user_id (username, display_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data as CommentWithUser;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

export async function getCommentCount(submissionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submissionId);

  if (error) throw error;
  return count ?? 0;
}

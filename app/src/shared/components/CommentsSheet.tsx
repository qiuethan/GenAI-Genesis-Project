import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../features/auth/context/AuthContext';
import {
  fetchComments,
  addComment,
  deleteComment,
  CommentWithUser,
} from '../services/commentService';
import { timeAgo } from '../hooks/useTimeAgo';

interface CommentsSheetProps {
  submissionId: string;
  onClose: () => void;
}

function CommentRow({
  comment,
  depth,
  onReply,
  onDelete,
  currentUserId,
}: {
  comment: CommentWithUser;
  depth: number;
  onReply: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  currentUserId: string | undefined;
}) {
  return (
    <View style={[styles.commentRow, { marginLeft: Math.min(depth, 3) * 24 }]}>
      <View style={styles.commentAvatar}>
        {comment.user.avatar_url ? (
          <Image source={{ uri: comment.user.avatar_url }} style={styles.commentAvatarImage} />
        ) : (
          <Text style={styles.commentAvatarText}>
            {(comment.user.username?.[0] ?? '?').toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>
            {comment.user.display_name || comment.user.username}
          </Text>
          <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
        </View>
        <Text style={styles.commentBody}>{comment.body}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity onPress={() => onReply(comment.id)}>
            <Text style={styles.commentAction}>Reply</Text>
          </TouchableOpacity>
          {currentUserId === comment.user_id && (
            <TouchableOpacity onPress={() => onDelete(comment.id)}>
              <Text style={[styles.commentAction, styles.deleteAction]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
        {comment.replies?.map((reply) => (
          <CommentRow
            key={reply.id}
            comment={reply}
            depth={depth + 1}
            onReply={onReply}
            onDelete={onDelete}
            currentUserId={currentUserId}
          />
        ))}
      </View>
    </View>
  );
}

export function CommentsSheet({ submissionId, onClose }: CommentsSheetProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchComments(submissionId);
      setComments(data);
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [submissionId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handlePost = async () => {
    if (!text.trim() || !user) return;
    setPosting(true);
    try {
      await addComment(submissionId, user.id, text.trim(), replyTo ?? undefined);
      setText('');
      setReplyTo(null);
      await loadComments();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setPosting(false);
  };

  const handleDelete = async (commentId: string) => {
    Alert.alert('Delete comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(commentId);
            await loadComments();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleReply = (commentId: string) => {
    setReplyTo(commentId);
  };

  const totalCount = comments.reduce(
    (sum, c) => sum + 1 + (c.replies?.length ?? 0),
    0
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments ({totalCount})</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Comment list */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                depth={0}
                onReply={handleReply}
                onDelete={handleDelete}
                currentUserId={user?.id}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={32} color="#333" />
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment</Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Reply indicator */}
        {replyTo && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyText}>Replying to comment</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor="#555"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handlePost}
            disabled={!text.trim() || posting}
            style={styles.sendButton}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={text.trim() ? '#fff' : '#444'}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 2,
  },
  commentAvatarImage: {
    width: 28,
    height: 28,
  },
  commentAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  commentContent: {
    flex: 1,
    marginLeft: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  commentTime: {
    fontSize: 11,
    color: '#555',
  },
  commentBody: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginTop: 2,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  commentAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  deleteAction: {
    color: '#ff4444',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#444',
    marginTop: 4,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  replyText: {
    fontSize: 13,
    color: '#888',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#fff',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

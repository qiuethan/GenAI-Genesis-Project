import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FeedItem } from '../types/database';
import { COMPOSITION_LABELS } from '../types/database';
import { timeAgo } from '../hooks/useTimeAgo';
import { toggleReaction } from '../services/reactionService';
import { savePost, unsavePost } from '../services/savedPostService';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { PostCardContextMenu } from './PostCardContextMenu';

const SCREEN_WIDTH = Dimensions.get('window').width;

const RANK_COLORS: Record<number, { color: string; bg: string }> = {
  1: { color: '#FFD700', bg: 'rgba(255, 215, 0, 0.15)' },
  2: { color: '#C0C0C0', bg: 'rgba(192, 192, 192, 0.12)' },
  3: { color: '#CD7F32', bg: 'rgba(205, 127, 50, 0.12)' },
};

interface PostCardProps {
  item: FeedItem;
  currentUserId?: string;
  onPressPhoto?: () => void;
  onPressUser?: () => void;
  showRank?: boolean;
  totalSubmissions?: number;
}

export function PostCard({
  item,
  currentUserId,
  onPressPhoto,
  onPressUser,
  showRank = false,
  totalSubmissions,
}: PostCardProps) {
  const compositionLabel = COMPOSITION_LABELS[item.composition_type] ?? item.composition_type;

  const [liked, setLiked] = useState(item.user_has_reacted);
  const [likeCount, setLikeCount] = useState(item.reaction_count);
  const [saved, setSaved] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const handleLike = useCallback(async () => {
    if (!currentUserId) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    hapticLight();
    try {
      await toggleReaction(item.id, currentUserId, wasLiked);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    }
  }, [currentUserId, item.id, liked]);

  const handleSave = useCallback(async () => {
    if (!currentUserId) return;
    const wasSaved = saved;
    setSaved(!wasSaved);
    hapticLight();
    try {
      if (wasSaved) {
        await unsavePost(currentUserId, item.id);
      } else {
        await savePost(currentUserId, item.id);
      }
    } catch {
      setSaved(wasSaved);
    }
  }, [currentUserId, item.id, saved]);

  const handleLongPress = useCallback(() => {
    hapticSuccess();
    setMenuVisible(true);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={onPressUser} activeOpacity={0.7}>
        <View style={styles.avatar}>
          {item.user.avatar_url ? (
            <Image source={{ uri: item.user.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarFallback}>
              {(item.user.username?.[0] ?? '?').toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={styles.username}>{item.user.display_name || item.user.username}</Text>
            {item.user.composition_badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>◈ Best at {item.user.composition_badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.timestamp}>{timeAgo(item.submitted_at)}</Text>
        </View>
        {showRank && item.rank != null && item.rank <= 3 && (
          <View style={[styles.rankBadge, { backgroundColor: RANK_COLORS[item.rank]?.bg }]}>
            <Ionicons name="trophy" size={14} color={RANK_COLORS[item.rank]?.color} />
            <Text style={[styles.rankText, { color: RANK_COLORS[item.rank]?.color }]}>
              {item.rank}
            </Text>
          </View>
        )}
        {showRank && item.rank != null && item.rank > 3 && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>
              #{item.rank}{totalSubmissions ? `/${totalSubmissions}` : ''}
            </Text>
          </View>
        )}
        {showRank && item.rank == null && (
          <View style={[styles.rankBadge, styles.pendingBadge]}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Photo — long press for context menu */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onPressPhoto}
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        <Image source={{ uri: item.photo_url }} style={styles.photo} />
      </TouchableOpacity>

      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.compositionTag}>
          <Text style={styles.compositionTagText}>◈ {compositionLabel}</Text>
        </View>
        {item.challenge_title ? (
          <Text style={styles.challengeName} numberOfLines={1}>
            {item.challenge_title}
          </Text>
        ) : null}
        {item.score != null && (
          <Text style={styles.scoreText}>
            {(item.score * 100).toFixed(0)}
          </Text>
        )}
      </View>

      {/* Caption */}
      {item.caption ? (
        <Text style={styles.caption} numberOfLines={3}>
          <Text style={styles.captionUsername}>{item.user.username} </Text>
          {item.caption}
        </Text>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? '#ff3b5c' : '#888'}
          />
          {likeCount > 0 && (
            <Text style={styles.actionCount}>{likeCount}</Text>
          )}
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={saved ? '#fff' : '#888'}
          />
        </TouchableOpacity>
      </View>

      {/* Context menu */}
      <PostCardContextMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        submissionId={item.id}
        photoUrl={item.photo_url}
        currentUserId={currentUserId}
        isOwnPost={currentUserId === item.user_id}
        compositionLabel={compositionLabel}
        onSaved={() => setSaved(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  avatarFallback: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#1a1a2e',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    color: '#8888ff',
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  pendingBadge: {
    borderColor: '#555',
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#111',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
  },
  compositionTag: {
    backgroundColor: '#1a1a2e',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  compositionTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8888ff',
  },
  challengeName: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  caption: {
    paddingHorizontal: 14,
    paddingTop: 8,
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: '600',
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
});

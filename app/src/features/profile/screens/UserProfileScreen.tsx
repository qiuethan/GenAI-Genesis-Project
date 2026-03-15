import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/context/AuthContext';
import {
  useUserProfile,
  useUserSubmissions,
  useUserChallengeHistory,
  useUserPodiums,
} from '../../../shared/hooks/useProfile';
import { followUser, unfollowUser, isFollowing } from '../../../shared/services/followService';
import { COMPOSITION_LABELS } from '../../../shared/types/database';
import type { Submission } from '../../../shared/types/database';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { UserProfileScreensParamList } from '../../../app/navigation/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 2;
const GRID_COLS = 3;
const GRID_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type Props = {
  route: RouteProp<UserProfileScreensParamList, 'UserProfile'>;
};

type Tab = 'photos' | 'challenges' | 'podium';

export function UserProfileScreen({ route }: Props) {
  const { userId } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<UserProfileScreensParamList, 'UserProfile'>>();
  const { user: currentUser } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile(userId);
  const { submissions } = useUserSubmissions(userId);
  const { entries } = useUserChallengeHistory(userId);
  const { podiums } = useUserPodiums(userId);

  const [activeTab, setActiveTab] = useState<Tab>('photos');
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isSelf = currentUser?.id === userId;

  useEffect(() => {
    if (currentUser?.id && userId && !isSelf) {
      isFollowing(currentUser.id, userId).then(setFollowing).catch(() => {});
    }
  }, [currentUser?.id, userId, isSelf]);

  const handleToggleFollow = async () => {
    if (!currentUser?.id) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(currentUser.id, userId);
        setFollowing(false);
      } else {
        await followUser(currentUser.id, userId);
        setFollowing(true);
      }
      refetchProfile();
    } catch {
      // ignore
    }
    setFollowLoading(false);
  };

  const handleRefresh = useCallback(() => {
    refetchProfile();
  }, [refetchProfile]);

  useFocusEffect(
    useCallback(() => {
      refetchProfile();
    }, [refetchProfile])
  );

  if (profileLoading && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerUsername}>@{profile?.username ?? 'user'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Profile info */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {(profile?.username?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.displayName}>
          {profile?.display_name || profile?.username || 'User'}
        </Text>

        {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

        {profile?.composition_badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>◈ Best at {profile.composition_badge}</Text>
          </View>
        )}

        {!isSelf && (
          <TouchableOpacity
            style={[styles.followButton, following && styles.followingButton]}
            onPress={handleToggleFollow}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={following ? '#fff' : '#000'} />
            ) : (
              <Text style={[styles.followButtonText, following && styles.followingButtonText]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.challenges_entered ?? 0}</Text>
          <Text style={styles.statLabel}>Challenges</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.podium_finishes ?? 0}</Text>
          <Text style={styles.statLabel}>Podiums</Text>
        </View>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => profile?.id && navigation.navigate('FollowersList', { userId: profile.id })}
        >
          <Text style={styles.statValue}>{profile?.follower_count ?? 0}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => profile?.id && navigation.navigate('FollowingList', { userId: profile.id })}
        >
          <Text style={styles.statValue}>{profile?.following_count ?? 0}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'photos' && styles.tabItemActive]}
          onPress={() => setActiveTab('photos')}
        >
          <Ionicons name="grid-outline" size={20} color={activeTab === 'photos' ? '#fff' : '#555'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'challenges' && styles.tabItemActive]}
          onPress={() => setActiveTab('challenges')}
        >
          <Ionicons name="trophy-outline" size={20} color={activeTab === 'challenges' ? '#fff' : '#555'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'podium' && styles.tabItemActive]}
          onPress={() => setActiveTab('podium')}
        >
          <Ionicons name="medal-outline" size={20} color={activeTab === 'podium' ? '#fff' : '#555'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const TROPHY_COLORS: Record<number, { trophy: string; bg: string; rank: string }> = {
    1: { trophy: '#FFD700', bg: 'rgba(255, 215, 0, 0.12)', rank: '#FFD700' },
    2: { trophy: '#C0C0C0', bg: 'rgba(192, 192, 192, 0.10)', rank: '#C0C0C0' },
    3: { trophy: '#CD7F32', bg: 'rgba(205, 127, 50, 0.10)', rank: '#CD7F32' },
  };

  const renderTabContent = () => {
    if (activeTab === 'photos') {
      if (submissions.length === 0) {
        return (
          <View style={styles.emptyTab}>
            <Ionicons name="images-outline" size={32} color="#333" />
            <Text style={styles.emptyTabText}>No photos yet</Text>
          </View>
        );
      }
      return (
        <View style={styles.grid}>
          {submissions.map((s) => (
            <TouchableOpacity key={s.id} activeOpacity={0.8} onPress={() => navigation.navigate('PhotoViewer' as any, { uri: s.photo_url })}>
              <Image source={{ uri: s.photo_url }} style={styles.gridItem} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (activeTab === 'challenges') {
      if (entries.length === 0) {
        return (
          <View style={styles.emptyTab}>
            <Ionicons name="trophy-outline" size={32} color="#333" />
            <Text style={styles.emptyTabText}>No challenges entered</Text>
          </View>
        );
      }
      return (
        <View style={styles.podiumList}>
          {entries.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={styles.podiumRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ChallengeDetail' as any, { challengeId: entry.challenge_id })}
            >
              <Image
                source={{ uri: entry.photo_url }}
                style={styles.podiumThumb}
                resizeMode="cover"
              />
              <View style={styles.podiumInfo}>
                <Text style={styles.podiumTitle} numberOfLines={1}>
                  {entry.challenge_title}
                </Text>
                <Text style={styles.podiumMeta}>
                  {COMPOSITION_LABELS[entry.composition_type] ?? entry.composition_type}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {entry.rank != null && (
                  <Text style={styles.podiumScore}>#{entry.rank}</Text>
                )}
                {entry.score != null && (
                  <Text style={styles.podiumMeta}>
                    {(entry.score * 100).toFixed(0)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (podiums.length === 0) {
      return (
        <View style={styles.emptyTab}>
          <Ionicons name="trophy-outline" size={32} color="#333" />
          <Text style={styles.emptyTabText}>No podium finishes yet</Text>
        </View>
      );
    }
    return (
      <View style={styles.podiumList}>
        {podiums.map((entry) => {
          const colors = TROPHY_COLORS[entry.rank ?? 1] ?? TROPHY_COLORS[3];
          return (
            <TouchableOpacity
              key={entry.id}
              style={styles.podiumRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ChallengeDetail' as any, { challengeId: entry.challenge_id })}
            >
              <View style={[podiumIconStyles.trophyContainer, { backgroundColor: colors.bg }]}>
                <Ionicons name="trophy" size={18} color={colors.trophy} />
                <Text style={[podiumIconStyles.trophyRank, { color: colors.rank }]}>{entry.rank ?? 1}</Text>
              </View>
              <Image
                source={{ uri: entry.photo_url }}
                style={styles.podiumThumb}
                resizeMode="cover"
              />
              <View style={styles.podiumInfo}>
                <Text style={styles.podiumTitle} numberOfLines={1}>
                  {entry.challenge_title}
                </Text>
                <Text style={styles.podiumMeta}>
                  {COMPOSITION_LABELS[entry.composition_type] ?? entry.composition_type}
                </Text>
              </View>
              {entry.score != null && (
                <Text style={styles.podiumScore}>
                  {(entry.score * 100).toFixed(0)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderTabContent()}
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={profileLoading}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerUsername: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  profileCard: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  displayName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#1a1a2e',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8888ff',
  },
  followButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  followingButtonText: {
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    backgroundColor: '#111',
  },
  emptyTab: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTabText: {
    fontSize: 14,
    color: '#555',
    marginTop: 8,
  },
  podiumList: {
    paddingHorizontal: 16,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  podiumThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  podiumInfo: {
    flex: 1,
  },
  podiumTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  podiumMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  podiumScore: {
    fontSize: 13,
    color: '#888',
  },
});

const podiumIconStyles = StyleSheet.create({
  trophyContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyRank: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: -2,
  },
});

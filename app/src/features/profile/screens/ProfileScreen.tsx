import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/context/AuthContext';
import {
  useUserProfile,
  useUserSubmissions,
  useUserChallengeHistory,
  useUserPodiums,
} from '../../../shared/hooks/useProfile';
import { COMPOSITION_LABELS } from '../../../shared/types/database';
import { computeAndAwardBadge } from '../../../shared/services/badgeService';
import { ProfileHeaderSkeleton } from '../../../shared/components/Skeleton';
import type { Submission } from '../../../shared/types/database';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../../app/navigation/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLS = 3;
const GRID_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type Tab = 'photos' | 'challenges' | 'podium';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;
};

function PhotoGrid({ submissions, onPressPhoto }: { submissions: Submission[]; onPressPhoto?: (uri: string) => void }) {
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
        <TouchableOpacity key={s.id} activeOpacity={0.8} onPress={() => onPressPhoto?.(s.photo_url)}>
          <Image
            source={{ uri: s.photo_url }}
            style={styles.gridItem}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ChallengeHistory({
  entries,
  onPressEntry,
}: {
  entries: (Submission & { challenge_title: string })[];
  onPressEntry?: (entry: Submission & { challenge_title: string }, index: number) => void;
}) {
  if (entries.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="trophy-outline" size={32} color="#333" />
        <Text style={styles.emptyTabText}>No challenges entered</Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {entries.map((entry, index) => (
        <TouchableOpacity
          key={entry.id}
          style={styles.historyRow}
          onPress={() => onPressEntry?.(entry, index)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: entry.photo_url }}
            style={styles.historyThumb}
            resizeMode="cover"
          />
          <View style={styles.historyInfo}>
            <Text style={styles.historyTitle} numberOfLines={1}>
              {entry.challenge_title}
            </Text>
            <Text style={styles.historyMeta}>
              {COMPOSITION_LABELS[entry.composition_type] ?? entry.composition_type}
            </Text>
          </View>
          <View style={styles.historyStats}>
            {entry.rank != null && (
              <Text style={styles.historyRank}>#{entry.rank}</Text>
            )}
            {entry.score != null && (
              <Text style={styles.historyScore}>
                {(entry.score * 100).toFixed(0)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const TROPHY_COLORS: Record<number, { trophy: string; bg: string; rank: string }> = {
  1: { trophy: '#FFD700', bg: 'rgba(255, 215, 0, 0.12)', rank: '#FFD700' },
  2: { trophy: '#C0C0C0', bg: 'rgba(192, 192, 192, 0.10)', rank: '#C0C0C0' },
  3: { trophy: '#CD7F32', bg: 'rgba(205, 127, 50, 0.10)', rank: '#CD7F32' },
};

function RankTrophy({ rank }: { rank: number }) {
  const colors = TROPHY_COLORS[rank] ?? TROPHY_COLORS[3];
  return (
    <View style={[podiumStyles.trophyContainer, { backgroundColor: colors.bg }]}>
      <Ionicons name="trophy" size={18} color={colors.trophy} />
      <Text style={[podiumStyles.trophyRank, { color: colors.rank }]}>{rank}</Text>
    </View>
  );
}

function PodiumList({
  podiums,
  onPressEntry,
}: {
  podiums: (Submission & { challenge_title: string })[];
  onPressEntry?: (entry: Submission & { challenge_title: string }, index: number) => void;
}) {
  if (podiums.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="trophy-outline" size={32} color="#333" />
        <Text style={styles.emptyTabText}>No podium finishes yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {podiums.map((entry, index) => (
        <TouchableOpacity
          key={entry.id}
          style={styles.historyRow}
          onPress={() => onPressEntry?.(entry, index)}
          activeOpacity={0.7}
        >
          <RankTrophy rank={entry.rank ?? 1} />
          <Image
            source={{ uri: entry.photo_url }}
            style={styles.historyThumb}
            resizeMode="cover"
          />
          <View style={styles.historyInfo}>
            <Text style={styles.historyTitle} numberOfLines={1}>
              {entry.challenge_title}
            </Text>
            <Text style={styles.historyMeta}>
              {COMPOSITION_LABELS[entry.composition_type] ?? entry.composition_type}
            </Text>
          </View>
          {entry.score != null && (
            <Text style={styles.historyScore}>
              {(entry.score * 100).toFixed(0)}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile(user?.id);
  const { submissions, refetch: refetchPhotos } = useUserSubmissions(user?.id);
  const { entries, refetch: refetchHistory } = useUserChallengeHistory(user?.id);
  const { podiums, refetch: refetchPodiums } = useUserPodiums(user?.id);
  const [activeTab, setActiveTab] = useState<Tab>('photos');
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const openPhotoViewer = useCallback((photoUrls: string[], index: number) => {
    setPhotoViewerPhotos(photoUrls);
    setPhotoViewerIndex(index);
    setPhotoViewerVisible(true);
  }, []);

  const handleRefresh = useCallback(() => {
    refetchProfile();
    refetchPhotos();
    refetchHistory();
    refetchPodiums();
  }, [refetchProfile, refetchPhotos, refetchHistory, refetchPodiums]);

  useFocusEffect(
    useCallback(() => {
      handleRefresh();
      if (user?.id) {
        computeAndAwardBadge(user.id).catch(() => {});
      }
    }, [handleRefresh, user?.id])
  );

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'photos', label: 'Photos', icon: 'grid-outline' },
    { key: 'challenges', label: 'Challenges', icon: 'trophy-outline' },
    { key: 'podium', label: 'Podium', icon: 'medal-outline' },
  ];

  const renderHeader = () => (
    <View>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerUsername}>@{profile?.username ?? user?.user_metadata?.username ?? 'unknown'}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('UserSearch')} style={styles.headerIconBtn}>
            <Ionicons name="person-add-outline" size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.headerIconBtn}>
            <Ionicons name="settings-outline" size={22} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile card */}
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
          {profile?.display_name || profile?.username || 'New User'}
        </Text>

        {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

        {profile?.composition_badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>◈ Best at {profile.composition_badge}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
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
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? '#fff' : '#555'}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'photos':
        return <PhotoGrid submissions={submissions} onPressPhoto={(uri) => navigation.navigate('PhotoViewer', { uri })} />;
      case 'challenges':
        return (
          <ChallengeHistory
            entries={entries}
            onPressEntry={(entry) =>
              navigation.navigate('ChallengeDetail', { challengeId: entry.challenge_id })
            }
          />
        );
      case 'podium':
        return (
          <PodiumList
            podiums={podiums}
            onPressEntry={(entry) =>
              navigation.navigate('ChallengeDetail', { challengeId: entry.challenge_id })
            }
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Modal
        visible={photoViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewerVisible(false)}
      >
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setPhotoViewerVisible(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {photoViewerPhotos.length > 0 && (
            <FlatList
              data={photoViewerPhotos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={Math.min(photoViewerIndex, photoViewerPhotos.length - 1)}
              getItemLayout={(_: unknown, index: number) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              keyExtractor={(uri, index) => `${uri}-${index}`}
              renderItem={({ item }) => (
                <View style={styles.photoViewerSlide}>
                  <Image
                    source={{ uri: item }}
                    style={styles.photoViewerImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerUsername: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 4,
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
  editButton: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  listContainer: {
    padding: 16,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  historyThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  historyMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  historyStats: {
    alignItems: 'flex-end',
  },
  historyRank: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  historyScore: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
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
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

const podiumStyles = StyleSheet.create({
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

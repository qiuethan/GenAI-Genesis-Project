import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useActiveChallenge, useUpcomingChallenges } from '../../challenges/hooks/useChallenges';
import { useFollowingFeed } from '../../challenges/hooks/useSubmissions';
import { useAuth } from '../../auth/context/AuthContext';
import { useCountdown } from '../../../shared/hooks/useCountdown';
import { PostCard } from '../../../shared/components/PostCard';
import { HeroCardSkeleton, FeedSkeleton } from '../../../shared/components/Skeleton';
import { COMPOSITION_LABELS } from '../../../shared/types/database';
import type { Challenge, FeedItem } from '../../../shared/types/database';
import type { HomeScreenNavigationProp, MainTabParamList } from '../../../app/navigation/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

function HeroCard({ challenge }: { challenge: Challenge }) {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const countdown = useCountdown(challenge.submissions_close_at);
  const compositionLabel = COMPOSITION_LABELS[challenge.composition_type] ?? challenge.composition_type;

  return (
    <TouchableOpacity
      style={styles.heroCard}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('ChallengeDetail', { challengeId: challenge.id })}
    >
      {challenge.cover_image_url ? (
        <Image source={{ uri: challenge.cover_image_url }} style={styles.heroCover} />
      ) : (
        <View style={[styles.heroCover, styles.heroCoverFallback]} />
      )}
      <View style={styles.heroOverlay}>
        <View style={styles.heroTag}>
          <Text style={styles.heroTagText}>◈ {compositionLabel}</Text>
        </View>
        <Text style={styles.heroTitle}>{challenge.title}</Text>
        {challenge.description && (
          <Text style={styles.heroDescription} numberOfLines={2}>
            {challenge.description}
          </Text>
        )}

        <View style={styles.timerRow}>
          <Ionicons name="time-outline" size={16} color="#aaa" />
          <Text style={styles.timerText}>
            {countdown.isExpired ? 'Closed' : countdown.formatted}
          </Text>
          <Text style={styles.participantText}>
            {challenge.submission_count} submission{challenge.submission_count !== 1 ? 's' : ''}
          </Text>
        </View>

        {!countdown.isExpired && (
          <TouchableOpacity
            style={styles.submitCta}
            onPress={() => navigation.navigate('SubmitPhoto', { challengeId: challenge.id })}
          >
            <Ionicons name="camera" size={18} color="#000" />
            <Text style={styles.submitCtaText}>Submit a Photo</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function NextUpStrip({ challenges }: { challenges: Challenge[] }) {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  if (challenges.length === 0) return null;

  return (
    <View style={styles.nextUpSection}>
      <Text style={styles.sectionTitle}>Next Up</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={challenges}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.nextUpList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.nextUpCard}
            onPress={() => navigation.navigate('ChallengeDetail', { challengeId: item.id })}
          >
            <Text style={styles.nextUpType}>
              ◈ {COMPOSITION_LABELS[item.composition_type] ?? item.composition_type}
            </Text>
            <Text style={styles.nextUpTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.nextUpDate}>
              {new Date(item.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

export function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<CompositeNavigationProp<
    HomeScreenNavigationProp,
    BottomTabNavigationProp<MainTabParamList>
  >>();
  const { challenge: activeChallenge, loading: challengeLoading, refetch: refetchChallenge } = useActiveChallenge();
  const { challenges: upcoming, refetch: refetchUpcoming } = useUpcomingChallenges();
  const { submissions, loading: feedLoading, refetch: refetchFeed } = useFollowingFeed(user?.id);

  const refreshing = challengeLoading || feedLoading;

  const handleRefresh = useCallback(() => {
    refetchChallenge();
    refetchUpcoming();
    refetchFeed();
  }, [refetchChallenge, refetchUpcoming, refetchFeed]);

  useFocusEffect(
    useCallback(() => {
      handleRefresh();
    }, [handleRefresh])
  );

  const renderHeader = () => (
    <View>
      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>Frame</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('UserSearch')}
          style={styles.searchIconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {challengeLoading && !activeChallenge ? (
        <HeroCardSkeleton />
      ) : activeChallenge ? (
        <HeroCard challenge={activeChallenge} />
      ) : (
        <View style={styles.noChallenge}>
          <Ionicons name="sparkles-outline" size={32} color="#555" />
          <Text style={styles.noChallengeText}>No active challenge right now</Text>
          <Text style={styles.noChallengeSubtext}>Check back soon!</Text>
        </View>
      )}

      <NextUpStrip challenges={upcoming} />

      {submissions.length > 0 && (
        <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginTop: 16 }]}>
          Feed
        </Text>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (refreshing) return <FeedSkeleton count={2} />;
    return (
      <View style={styles.emptyFeed}>
        <Ionicons name="images-outline" size={40} color="#333" />
        <Text style={styles.emptyText}>No submissions yet</Text>
        <Text style={styles.emptySubtext}>Be the first to submit!</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList<FeedItem>
        data={submissions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            currentUserId={user?.id}
            onPressPhoto={() => navigation.navigate('PhotoViewer', { uri: item.photo_url })}
            onPressUser={() => {
              if (item.user_id === user?.id) {
                navigation.navigate('ProfileTab');
              } else {
                navigation.navigate('UserProfile', { userId: item.user_id });
              }
            }}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  searchIconBtn: {
    padding: 4,
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  heroCover: {
    width: SCREEN_WIDTH - 32,
    height: 200,
  },
  heroCoverFallback: {
    backgroundColor: '#1a1a2e',
  },
  heroOverlay: {
    padding: 16,
  },
  heroTag: {
    backgroundColor: '#1a1a2e',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8888ff',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  heroDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    marginBottom: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  participantText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 'auto',
  },
  submitCta: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitCtaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  nextUpSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  nextUpList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  nextUpCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    width: 160,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  nextUpType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8888ff',
    marginBottom: 6,
  },
  nextUpTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  nextUpDate: {
    fontSize: 12,
    color: '#666',
  },
  noChallenge: {
    marginHorizontal: 16,
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  noChallengeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    marginTop: 12,
  },
  noChallengeSubtext: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  emptyFeed: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    marginTop: 4,
  },
});

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/context/AuthContext';
import type { RouteProp } from '@react-navigation/native';
import type { ChallengesStackParamList } from '../../../app/navigation/types';
import { useChallengeDetail } from '../hooks/useChallenges';
import { useChallengeSubmissions } from '../hooks/useSubmissions';
import { useCountdown } from '../../../shared/hooks/useCountdown';
import { PostCard } from '../../../shared/components/PostCard';
import { FeedSkeleton } from '../../../shared/components/Skeleton';
import { COMPOSITION_LABELS } from '../../../shared/types/database';
import type { FeedItem } from '../../../shared/types/database';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Props = {
  route: RouteProp<ChallengesStackParamList, 'ChallengeDetail'>;
};

export function ChallengeDetailScreen({ route }: Props) {
  const { challengeId } = route.params;
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { challenge, loading: challengeLoading, refetch: refetchChallenge } = useChallengeDetail(challengeId);
  const { submissions, loading: feedLoading, refetch: refetchFeed } = useChallengeSubmissions(challengeId, user?.id);
  const countdown = useCountdown(challenge?.submissions_close_at);

  const compositionLabel = challenge
    ? (COMPOSITION_LABELS[challenge.composition_type] ?? challenge.composition_type)
    : '';

  // Refetch when screen gains focus (e.g. after submitting a photo) so the list shows your submission
  useFocusEffect(
    React.useCallback(() => {
      refetchChallenge();
      refetchFeed();
    }, [refetchChallenge, refetchFeed])
  );

  const renderHeader = () => {
    if (!challenge) return null;

    return (
      <View>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Cover image */}
        {challenge.cover_image_url ? (
          <Image source={{ uri: challenge.cover_image_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Ionicons name="image-outline" size={48} color="#333" />
          </View>
        )}

        {/* Challenge info */}
        <View style={styles.infoSection}>
          <View style={styles.compositionTag}>
            <Text style={styles.compositionTagText}>◈ {compositionLabel}</Text>
          </View>

          <Text style={styles.title}>{challenge.title}</Text>

          {challenge.description && (
            <Text style={styles.description}>{challenge.description}</Text>
          )}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="time-outline" size={16} color="#888" />
              <Text style={styles.statText}>
                {countdown.isExpired ? 'Closed' : countdown.formatted}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="people-outline" size={16} color="#888" />
              <Text style={styles.statText}>
                {challenge.participant_count} participant{challenge.participant_count !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="images-outline" size={16} color="#888" />
              <Text style={styles.statText}>
                {challenge.submission_count} submission{challenge.submission_count !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Example image */}
          {challenge.example_image_url && (
            <View style={styles.exampleSection}>
              <Text style={styles.exampleLabel}>Example</Text>
              <Image source={{ uri: challenge.example_image_url }} style={styles.exampleImage} />
            </View>
          )}

          {/* Submit CTA when challenge is open */}
          {!countdown.isExpired && challenge.status === 'ACTIVE' && (
            <TouchableOpacity
              style={styles.submitCta}
              onPress={() => navigation.navigate('SubmitPhoto', { challengeId: challenge.id })}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={18} color="#000" />
              <Text style={styles.submitCtaText}>Submit a Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submissions header */}
        <View style={styles.submissionsHeader}>
          <View>
            <Text style={styles.submissionsTitle}>Submitted photos</Text>
            <Text style={styles.submissionsSubtitle}>Photos submitted to this challenge</Text>
          </View>
          <Text style={styles.submissionsCount}>{submissions.length}</Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (challengeLoading || feedLoading) return <FeedSkeleton count={2} />;
    return (
      <View style={styles.emptyFeed}>
        <Ionicons name="trophy-outline" size={40} color="#333" />
        <Text style={styles.emptyText}>No submissions yet</Text>
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
            showRank
            currentUserId={user?.id}
            onPressUser={() => navigation.navigate('UserProfile' as never, { userId: item.user_id } as never)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={challengeLoading || feedLoading}
            onRefresh={() => { refetchChallenge(); refetchFeed(); }}
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
  backButton: {
    position: 'absolute',
    top: 8,
    left: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cover: {
    width: SCREEN_WIDTH,
    height: 240,
  },
  coverFallback: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    padding: 16,
  },
  compositionTag: {
    backgroundColor: '#1a1a2e',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  compositionTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8888ff',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#999',
    lineHeight: 22,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#888',
  },
  exampleSection: {
    marginTop: 8,
  },
  exampleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  exampleImage: {
    width: SCREEN_WIDTH - 32,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  submissionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  submissionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  submissionsSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  submissionsCount: {
    fontSize: 14,
    color: '#666',
  },
  submitCta: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  submitCtaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
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
});

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useActiveChallenge, useUpcomingChallenges, useChallengeArchive } from '../hooks/useChallenges';
import { COMPOSITION_LABELS } from '../../../shared/types/database';
import { ChallengeCardSkeleton } from '../../../shared/components/Skeleton';
import type { Challenge } from '../../../shared/types/database';
import type { ChallengesListNavigationProp } from '../../../app/navigation/types';

const PAST_LIMIT = 8;

const COMPOSITION_FILTERS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: 'All' },
  { key: 'rule_of_thirds', label: 'Rule of Thirds' },
  { key: 'center', label: 'Center' },
  { key: 'symmetric', label: 'Symmetric' },
  { key: 'vanishing_point', label: 'Vanishing Point' },
  { key: 'fill_the_frame', label: 'Fill the Frame' },
  { key: 'pattern', label: 'Pattern' },
  { key: 'golden_ratio', label: 'Golden Ratio' },
  { key: 'diagonal', label: 'Diagonal' },
  { key: 'triangle', label: 'Triangle' },
  { key: 'radial', label: 'Radial' },
  { key: 'curved', label: 'Curved' },
  { key: 'horizontal', label: 'Horizontal' },
  { key: 'vertical', label: 'Vertical' },
];

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const navigation = useNavigation<ChallengesListNavigationProp>();
  const compositionLabel = COMPOSITION_LABELS[challenge.composition_type] ?? challenge.composition_type;

  const statusColors: Record<string, string> = {
    ACTIVE: '#22c55e',
    SCHEDULED: '#eab308',
    CLOSED: '#888',
    ARCHIVED: '#555',
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ChallengeDetail', { challengeId: challenge.id })}
      activeOpacity={0.8}
    >
      {challenge.cover_image_url ? (
        <Image source={{ uri: challenge.cover_image_url }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImageFallback]}>
          <Ionicons name="image-outline" size={20} color="#333" />
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{challenge.title}</Text>
          <View style={[styles.statusDot, { backgroundColor: statusColors[challenge.status] ?? '#555' }]} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.compositionTagText}>{compositionLabel}</Text>
          <Text style={styles.cardStats}>
            {challenge.submission_count} submission{challenge.submission_count !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

export function ChallengesListScreen() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const filterKey = filter ?? undefined;
  const { challenge: activeChallenge, loading: activeLoading, refetch: refetchActive } = useActiveChallenge(filterKey);
  const { challenges: upcoming, loading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingChallenges(5, filterKey);
  const { challenges: archived, loading: archiveLoading, refetch: refetchArchive } = useChallengeArchive(filterKey);

  const loading = activeLoading || upcomingLoading || archiveLoading;
  const refetch = useCallback(() => {
    refetchActive();
    refetchUpcoming();
    refetchArchive();
  }, [refetchActive, refetchUpcoming, refetchArchive]);

  const sections = useMemo(() => {
    const list: { title: string; data: Challenge[] }[] = [];
    const activeList = activeChallenge ? [activeChallenge] : [];
    const pastList = archived.slice(0, PAST_LIMIT);
    if (activeList.length) list.push({ title: 'Active', data: activeList });
    if (upcoming.length) list.push({ title: 'Upcoming', data: upcoming });
    if (pastList.length) list.push({ title: 'Past', data: pastList });
    return list;
  }, [activeChallenge, upcoming, archived]);

  const header = (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Challenges</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterStrip}
      >
        {COMPOSITION_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key ?? 'all'}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SectionList<Challenge>
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChallengeCard challenge={item} />}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonWrap}>
              {[1, 2, 3].map((i) => <ChallengeCardSkeleton key={i} />)}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={40} color="#333" />
              <Text style={styles.emptyText}>
                {filter ? `No ${COMPOSITION_FILTERS.find((f) => f.key === filter)?.label ?? filter} challenges` : 'No challenges yet'}
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor="#fff" />
        }
        contentContainerStyle={styles.listContent}
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  filterStrip: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    backgroundColor: '#1a1a1a',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  filterChipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  filterChipTextActive: {
    color: '#000',
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: '#111',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  cardImage: {
    width: 72,
    height: 72,
  },
  cardImageFallback: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    minHeight: 72,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  compositionTagText: {
    fontSize: 11,
    color: '#8888ff',
    fontWeight: '500',
  },
  cardStats: {
    fontSize: 11,
    color: '#555',
  },
  skeletonWrap: {
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 10,
    textAlign: 'center',
  },
});

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/context/AuthContext';
import { useGlobalFeed } from '../../challenges/hooks/useSubmissions';
import { PostCard } from '../../../shared/components/PostCard';
import { FeedSkeleton } from '../../../shared/components/Skeleton';
import type { FeedItem } from '../../../shared/types/database';
import type { ExploreScreenNavigationProp } from '../../../app/navigation/types';

export function ExploreScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<ExploreScreenNavigationProp>();
  const { submissions, loading, refetch } = useGlobalFeed(50, user?.id);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const renderEmpty = useCallback(() => {
    if (loading) return <FeedSkeleton count={3} />;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="globe-outline" size={48} color="#333" />
        <Text style={styles.emptyTitle}>No photos yet</Text>
        <Text style={styles.emptySubtext}>
          Submissions from all challenges will appear here.
        </Text>
      </View>
    );
  }, [loading]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList<FeedItem>
        data={submissions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            currentUserId={user?.id}
            showRank
            onPressPhoto={() => navigation.navigate('PhotoViewer', { uri: item.photo_url })}
            onPressUser={() => navigation.navigate('UserProfile', { userId: item.user_id })}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Explore</Text>
          </View>
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

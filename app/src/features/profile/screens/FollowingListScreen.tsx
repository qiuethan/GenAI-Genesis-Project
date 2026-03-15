import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getFollowing, type FollowProfileRow } from '../../../shared/services/followService';
import type { ProfileStackParamList } from '../../../app/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'FollowingList'>;
type Route = RouteProp<ProfileStackParamList, 'FollowingList'>;

function UserRow({ row, onPress }: { row: FollowProfileRow; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {row.avatar_url ? (
        <Image source={{ uri: row.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{(row.username[0] ?? '?').toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.username}>@{row.username}</Text>
        {row.display_name ? (
          <Text style={styles.displayName} numberOfLines={1}>{row.display_name}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#444" />
    </TouchableOpacity>
  );
}

export function FollowingListScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const userId = params.userId;
  const [list, setList] = useState<FollowProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFollowing(userId);
      setList(data);
    } catch {
      setList([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Following</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserRow
            row={item}
            onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor="#fff" />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color="#333" />
              <Text style={styles.emptyText}>Not following anyone yet</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', marginLeft: 8 },
  listContent: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#333', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '600', color: '#888' },
  rowInfo: { flex: 1 },
  username: { fontSize: 15, fontWeight: '600', color: '#fff' },
  displayName: { fontSize: 13, color: '#888', marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: '#666', marginTop: 12 },
});

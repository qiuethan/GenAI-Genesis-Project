import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/context/AuthContext';
import { searchUsers, type SearchUserRow } from '../../../shared/services/searchService';
import { followUser, unfollowUser, isFollowing } from '../../../shared/services/followService';
import type { UserSearchScreensParamList } from '../../../app/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const DEBOUNCE_MS = 300;

type Nav = NativeStackNavigationProp<UserSearchScreensParamList, 'UserSearch'>;

function UserRow({
  row,
  currentUserId,
  onPress,
}: {
  row: SearchUserRow;
  currentUserId: string | undefined;
  onPress: () => void;
}) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUserId && row.id !== currentUserId) {
      isFollowing(currentUserId, row.id).then(setFollowing).catch(() => {});
    }
  }, [currentUserId, row.id]);

  const handleToggleFollow = async (e: any) => {
    e?.stopPropagation?.();
    if (!currentUserId || currentUserId === row.id) return;
    setLoading(true);
    try {
      if (following) {
        await unfollowUser(currentUserId, row.id);
        setFollowing(false);
      } else {
        await followUser(currentUserId, row.id);
        setFollowing(true);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const isSelf = currentUserId === row.id;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isSelf}
    >
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
      {!isSelf && currentUserId && (
        <TouchableOpacity
          style={[styles.followBtn, following && styles.followBtnActive]}
          onPress={handleToggleFollow}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export function UserSearchScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchUserRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchUsers(debouncedQuery, user?.id)
      .then((list) => {
        if (!cancelled) setResults(list);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery, user?.id]);

  const renderItem = useCallback(
    ({ item }: { item: SearchUserRow }) => (
      <UserRow
        row={item}
        currentUserId={user?.id}
        onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
      />
    ),
    [user?.id, navigation]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Find people</Text>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.input}
            placeholder="Search by username or name"
            placeholderTextColor="#555"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#888" />
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !loading && debouncedQuery.trim() ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No users found for "{debouncedQuery}"</Text>
              </View>
            ) : debouncedQuery.trim().length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color="#333" />
                <Text style={styles.emptyHint}>Search by username or display name</Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />
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
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    padding: 0,
  },
  loadingWrap: {
    padding: 12,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
  },
  rowInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  displayName: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    minWidth: 80,
    alignItems: 'center',
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  followBtnTextActive: {
    color: '#888',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    color: '#555',
    marginTop: 12,
  },
});

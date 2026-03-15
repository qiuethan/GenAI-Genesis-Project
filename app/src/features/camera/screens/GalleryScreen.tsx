import React, { useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useGallery } from '../hooks';
import { useAlbums, createAlbum, deleteAlbum } from '../hooks/useAlbums';
import { useGalleryScores } from '../hooks/useGalleryScores';
import { useAuth } from '../../auth/context/AuthContext';
import { useUserProfile } from '../../../shared/hooks/useProfile';
import { PhotoAsset } from '../../../infra/mediaLibrary';
import { galleryStyles as styles } from '../styles/GalleryScreen.styles';
import type { Album } from '../hooks/useAlbums';

const COMPOSITION_DISPLAY_NAMES: Record<string, string> = {
  rule_of_thirds: 'Rule of Thirds',
  symmetric: 'Symmetric',
  diagonal: 'Diagonal',
  golden_ratio: 'Golden Ratio',
  triangle: 'Triangle',
  center: 'Center',
  curved: 'Curved',
  horizontal: 'Horizontal',
  radial: 'Radial',
  vanishing_point: 'Vanishing Point',
  vertical: 'Vertical',
};

interface DisplayAlbum {
  id: string;
  name: string;
  coverUri: string | null;
  count: number;
}

export const GalleryScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { photos, loading } = useGallery(100);
  const { albums, refresh: refreshAlbums } = useAlbums();
  const { scores } = useGalleryScores();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id);

  useFocusEffect(
    useCallback(() => {
      refreshAlbums();
    }, [refreshAlbums])
  );

  // Build a photo lookup by id for resolving album cover images
  const photoById = useMemo(() => {
    const map: Record<string, PhotoAsset> = {};
    for (const p of photos) map[p.id] = p;
    return map;
  }, [photos]);

  // Build display albums: "All Photos" first, then user-created albums
  const displayAlbums = useMemo<DisplayAlbum[]>(() => {
    const result: DisplayAlbum[] = [
      {
        id: '__all__',
        name: 'All Photos',
        coverUri: photos[0]?.uri ?? null,
        count: photos.length,
      },
    ];

    for (const album of albums) {
      // Find the first photo that still exists in the library for the cover
      let coverUri: string | null = null;
      let validCount = 0;
      for (const pid of album.photoIds) {
        const photo = photoById[pid];
        if (photo) {
          validCount++;
          if (!coverUri) coverUri = photo.uri;
        }
      }
      result.push({
        id: album.id,
        name: album.name,
        coverUri,
        count: validCount,
      });
    }

    return result;
  }, [photos, albums, photoById]);

  // Build composition categories from scored photos
  const categories = useMemo(() => {
    const byType: Record<string, { photoIds: string[]; coverUri: string | null }> = {};
    for (const photo of photos) {
      const score = scores[photo.id];
      if (!score?.composition_type) continue;
      const type = score.composition_type;
      if (!byType[type]) byType[type] = { photoIds: [], coverUri: null };
      byType[type].photoIds.push(photo.id);
      if (!byType[type].coverUri) byType[type].coverUri = photo.uri;
    }
    // Show all known types, populated ones first sorted by count, then empty ones
    return Object.entries(COMPOSITION_DISPLAY_NAMES)
      .map(([type, name]) => ({
        type,
        name,
        coverUri: byType[type]?.coverUri ?? null,
        count: byType[type]?.photoIds.length ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [photos, scores]);

  const handleAlbumPress = (album: DisplayAlbum) => {
    (navigation as any).navigate('AlbumDetail', {
      albumId: album.id,
      albumName: album.name,
    });
  };

  const handleDeleteAlbum = (album: DisplayAlbum) => {
    if (album.id === '__all__') return;
    Alert.alert(
      'Delete Album',
      `Delete "${album.name}"? Photos won't be deleted from your device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAlbum(album.id);
          },
        },
      ],
    );
  };

  const handleCreateAlbum = () => {
    Alert.prompt(
      'New Album',
      'Enter a name for this album',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (name?: string) => {
            if (name && name.trim()) {
              await createAlbum(name.trim());
              refreshAlbums();
            }
          },
        },
      ],
      'plain-text',
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconButton}>
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Image
              source={require('../../../../assets/icon_transparent.png')}
              style={styles.headerLogo}
              contentFit="contain"
            />
            <Text style={styles.headerTitle}>Gallery</Text>
          </View>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('ProfileTab')}
            style={styles.headerIconButton}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {(profile?.username?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* My Albums */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Albums</Text>
          <TouchableOpacity onPress={handleCreateAlbum}>
            <Text style={styles.seeAllText}>+ New</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={displayAlbums}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.albumList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.albumCard}
              onPress={() => handleAlbumPress(item)}
              onLongPress={() => handleDeleteAlbum(item)}
              activeOpacity={0.8}
            >
              {item.coverUri ? (
                <Image
                  source={{ uri: item.coverUri }}
                  style={styles.albumImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.albumPlaceholder}>
                  <Ionicons name="images-outline" size={36} color="#555" />
                </View>
              )}
              <View style={styles.albumLabelContainer}>
                <View style={styles.albumLabel}>
                  <Text style={styles.albumLabelText}>
                    {item.name}
                  </Text>
                </View>
              </View>
              <View style={styles.albumCountContainer}>
                <Text style={styles.albumCountText}>{item.count}</Text>
              </View>
            </TouchableOpacity>
          )}
        />

        {/* Composition Categories */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Composition</Text>
        </View>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          keyExtractor={(item) => item.type}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.categoryCard, item.count === 0 && { opacity: 0.4 }]}
              activeOpacity={0.8}
              disabled={item.count === 0}
              onPress={() => (navigation as any).navigate('AlbumDetail', {
                albumId: `__comp_${item.type}__`,
                albumName: item.name,
                compositionType: item.type,
              })}
            >
              {item.coverUri ? (
                <Image
                  source={{ uri: item.coverUri }}
                  style={styles.categoryImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.albumPlaceholder}>
                  <Ionicons name="grid-outline" size={36} color="#555" />
                </View>
              )}
              <View style={styles.categoryLabelContainer}>
                <View style={styles.categoryLabel}>
                  <Text style={styles.categoryLabelText}>{item.name}</Text>
                </View>
              </View>
              {item.count > 0 && (
                <View style={styles.albumCountContainer}>
                  <Text style={styles.albumCountText}>{item.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </ScrollView>
    </View>
  );
};

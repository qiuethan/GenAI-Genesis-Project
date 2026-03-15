import React, { useEffect, useRef } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { IconButton } from '../components/IconButton';
import { useGallery, useGalleryScores, scorePhoto } from '../hooks';
import { PhotoAsset } from '../../../infra/mediaLibrary';
import { galleryStyles as styles, GALLERY_CONSTANTS } from '../styles/GalleryScreen.styles';

const { COLUMNS } = GALLERY_CONSTANTS;

const scoreToColor = (score: number): string => {
  const t = Math.max(0, Math.min(1, score / 100));
  if (t < 0.25) return '#ff4444';
  if (t < 0.5) return '#ff9900';
  if (t < 0.75) return '#aacc00';
  return '#44cc44';
};

export const GalleryScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { photos, loading } = useGallery(100);
  const { scores, refresh } = useGalleryScores();
  const scoringInProgress = useRef<Set<string>>(new Set());

  // Refresh scores when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Auto-score unscored photos and refresh UI as results arrive
  useEffect(() => {
    if (photos.length === 0) return;

    const unscoredPhotos = photos.filter(
      p => !scores[p.id] && !scoringInProgress.current.has(p.id)
    );

    if (unscoredPhotos.length === 0) return;

    unscoredPhotos.forEach(photo => {
      scoringInProgress.current.add(photo.id);
      scorePhoto(photo.id, photo.uri)
        .then(() => refresh())
        .catch(() => {})
        .finally(() => scoringInProgress.current.delete(photo.id));
    });
  }, [photos, scores, refresh]);

  const handlePhotoPress = (photo: PhotoAsset, index: number) => {
    (navigation as any).navigate('ImageViewer', {
      imageUri: photo.uri,
      allPhotos: photos.map(p => p.uri),
      initialIndex: index,
    });
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const renderPhoto = ({ item, index }: { item: PhotoAsset; index: number }) => {
    const score = scores[item.id];
    return (
      <TouchableOpacity
        style={styles.photoItem}
        onPress={() => handlePhotoPress(item, index)}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.photoImage}
          contentFit="cover"
        />
        {score && (score.aesthetic_score ?? score.score) != null && (
          <View style={badgeStyles.badgeContainer}>
            <View style={[badgeStyles.badge, { backgroundColor: scoreToColor(score.aesthetic_score ?? score.score!) }]}>
              <Text style={badgeStyles.text}>{Math.round(score.aesthetic_score ?? score.score!)}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 10 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleClose}>
            <IconButton
              iconName="chevron-back"
              size={20}
              onPress={handleClose}
              color="white"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Photos</Text>
          <View style={{ width: 20 }} />
        </View>
      </View>

      {/* Photo Grid */}
      <FlatList
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentContainerStyle={[
          styles.gridContainer,
          {
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 20
          }
        ]}
        columnWrapperStyle={styles.row}
      />

    </View>
  );
};

const badgeStyles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    gap: 2,
    alignItems: 'flex-end',
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 24,
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

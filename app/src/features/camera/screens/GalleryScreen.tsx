import React, { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { IconButton } from '../components/IconButton';
import { useGallery, useGalleryScores, scorePhotoBatch, scoreToColor } from '../hooks';
import { PhotoAsset } from '../../../infra/mediaLibrary';
import { galleryStyles as styles, GALLERY_CONSTANTS } from '../styles/GalleryScreen.styles';

const { COLUMNS } = GALLERY_CONSTANTS;

export const GalleryScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { photos, loading } = useGallery(100);
  const { scores } = useGalleryScores();

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchScoring, setBatchScoring] = useState(false);

  const handlePhotoPress = (photo: PhotoAsset, index: number) => {
    if (selectionMode) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(photo.id)) {
          next.delete(photo.id);
          if (next.size === 0) setSelectionMode(false);
        } else {
          next.add(photo.id);
        }
        return next;
      });
      return;
    }
    (navigation as any).navigate('ImageViewer', {
      imageUri: photo.uri,
      allPhotos: photos.map(p => p.uri),
      allPhotoIds: photos.map(p => p.id),
      initialIndex: index,
    });
  };

  const handleLongPress = (photo: PhotoAsset) => {
    if (selectionMode) return;
    setSelectionMode(true);
    setSelectedIds(new Set([photo.id]));
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleClose = () => {
    navigation.goBack();
  };

  // Get unscored selected photos
  const unscoredSelected = selectionMode
    ? photos.filter(p => selectedIds.has(p.id) && !scores[p.id])
    : [];

  const handleBatchScore = useCallback(async () => {
    if (unscoredSelected.length === 0 || batchScoring) return;
    setBatchScoring(true);
    try {
      await scorePhotoBatch(unscoredSelected.map(p => ({ id: p.id, uri: p.uri })));
    } catch {}
    setBatchScoring(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [unscoredSelected, batchScoring]);

  const renderPhoto = ({ item, index }: { item: PhotoAsset; index: number }) => {
    const score = scores[item.id];
    const isSelected = selectionMode && selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={[
          styles.photoItem,
          isSelected && selectStyles.selectedItem,
        ]}
        onPress={() => handlePhotoPress(item, index)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.photoImage}
          contentFit="cover"
        />
        {score && (
          <View style={badgeStyles.badgeContainer}>
            <View style={[badgeStyles.badge, { backgroundColor: scoreToColor(score.aesthetic_score) }]}>
              <Text style={badgeStyles.text}>{Math.round(score.aesthetic_score)}</Text>
            </View>
            {score.composition_score != null && (
              <View style={[badgeStyles.badge, { backgroundColor: scoreToColor(score.composition_score) }]}>
                <Text style={badgeStyles.text}>{Math.round(score.composition_score)}</Text>
              </View>
            )}
          </View>
        )}
        {isSelected && (
          <View style={selectStyles.checkOverlay}>
            <View style={selectStyles.checkCircle}>
              <Text style={selectStyles.checkMark}>✓</Text>
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
          {selectionMode ? (
            <>
              <TouchableOpacity onPress={handleCancelSelection}>
                <Text style={selectStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{selectedIds.size} selected</Text>
              <View style={{ width: 50 }} />
            </>
          ) : (
            <>
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
            </>
          )}
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
            paddingBottom: insets.bottom + 80
          }
        ]}
        columnWrapperStyle={styles.row}
      />

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        {selectionMode && unscoredSelected.length > 0 && (
          <TouchableOpacity
            style={selectStyles.batchButton}
            onPress={handleBatchScore}
            disabled={batchScoring}
          >
            {batchScoring ? (
              <>
                <ActivityIndicator color="#000" size="small" />
                <Text style={selectStyles.batchButtonText}>
                  Scoring {unscoredSelected.length} photo{unscoredSelected.length !== 1 ? 's' : ''}...
                </Text>
              </>
            ) : (
              <Text style={selectStyles.batchButtonText}>
                Score {unscoredSelected.length} Photo{unscoredSelected.length !== 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
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

const selectStyles = StyleSheet.create({
  selectedItem: {
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00ff88',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  batchButton: {
    backgroundColor: '#ffe81f',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  batchButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
});

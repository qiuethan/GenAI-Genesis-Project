import React, { useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useGallery } from '../hooks';
import { useAlbums, addPhotosToAlbum, removePhotosFromAlbum } from '../hooks/useAlbums';
import { useGalleryScores } from '../hooks/useGalleryScores';
import { PhotoAsset } from '../../../infra/mediaLibrary';

const { width } = Dimensions.get('window');
const COLUMNS = 3;
const SPACING = 2;
const ITEM_SIZE = (width - SPACING * (COLUMNS + 1)) / COLUMNS;

export const AlbumDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { albumId, albumName } = route.params as { albumId: string; albumName: string };
  const { photos } = useGallery(100);
  const { albums, refresh } = useAlbums();

  const { scores } = useGalleryScores();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const album = albums.find((a) => a.id === albumId);
  const photoIdSet = useMemo(() => new Set(album?.photoIds ?? []), [album?.photoIds]);

  // "All Photos" is a virtual album showing everything
  const isAllPhotos = albumId === '__all__';
  const albumPhotos = useMemo(() => {
    if (isAllPhotos) return photos;
    return photos.filter((p) => photoIdSet.has(p.id));
  }, [isAllPhotos, photos, photoIdSet]);

  const handlePhotoPress = (photo: PhotoAsset, index: number) => {
    if (selecting) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(photo.id)) {
          next.delete(photo.id);
        } else {
          next.add(photo.id);
        }
        return next;
      });
      return;
    }
    (navigation as any).navigate('ImageViewer', {
      imageUri: photo.uri,
      allPhotos: albumPhotos.map((p) => p.uri),
      allPhotoIds: albumPhotos.map((p) => p.id),
      initialIndex: index,
      albumId,
    });
  };

  const handleAddPhotos = () => {
    (navigation as any).navigate('PhotoPicker', { albumId });
  };

  const handleCancelSelect = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const handleSelectAll = () => {
    if (selectedIds.size === albumPhotos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(albumPhotos.map((p) => p.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    const title = isAllPhotos ? 'Delete Photos' : 'Remove Photos';
    const message = isAllPhotos
      ? `Delete ${count} ${count === 1 ? 'photo' : 'photos'} from your device?`
      : `Remove ${count} ${count === 1 ? 'photo' : 'photos'} from this album?`;
    const action = isAllPhotos ? 'Delete' : 'Remove';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: 'destructive',
        onPress: async () => {
          const ids = Array.from(selectedIds);
          if (isAllPhotos) {
            try {
              await MediaLibrary.deleteAssetsAsync(ids);
            } catch {}
          } else {
            await removePhotosFromAlbum(albumId, ids);
          }
          handleCancelSelect();
        },
      },
    ]);
  };

  const badgeColor = (score: number): string => {
    const t = Math.max(0, Math.min(1, score / 100));
    if (t < 0.25) return '#ff4444';
    if (t < 0.5) return '#ff9900';
    if (t < 0.75) return '#aacc00';
    return '#44cc44';
  };

  const renderPhoto = ({ item, index }: { item: PhotoAsset; index: number }) => {
    const isSelected = selectedIds.has(item.id);
    const photoScore = scores[item.id];
    return (
      <TouchableOpacity
        style={gridStyles.photoItem}
        onPress={() => handlePhotoPress(item, index)}
        onLongPress={() => {
          if (!selecting) {
            setSelecting(true);
            setSelectedIds(new Set([item.id]));
          }
        }}
      >
        <Image source={{ uri: item.uri }} style={gridStyles.photoImage} contentFit="cover" />
        {!selecting && photoScore && (
          <View style={gridStyles.scoreBadge}>
            <Text style={[gridStyles.scoreBadgeText, { color: badgeColor(photoScore.aesthetic_score) }]}>
              {Math.round(photoScore.aesthetic_score)}
            </Text>
          </View>
        )}
        {selecting && (
          <View style={gridStyles.selectOverlay}>
            <View
              style={[
                gridStyles.checkbox,
                isSelected && gridStyles.checkboxSelected,
              ]}
            >
              {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const allSelected = albumPhotos.length > 0 && selectedIds.size === albumPhotos.length;

  return (
    <View style={gridStyles.container}>
      {/* Sticky Header */}
      <View style={[gridStyles.headerContainer, { paddingTop: insets.top + 8 }]}>
        <View style={gridStyles.headerRow}>
          {selecting ? (
            <>
              <TouchableOpacity onPress={handleCancelSelect} style={gridStyles.headerLeft}>
                <Text style={gridStyles.headerTextButtonLabel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={gridStyles.title} numberOfLines={1}>
                {selectedIds.size} Selected
              </Text>
              <TouchableOpacity onPress={handleSelectAll} style={gridStyles.headerRight}>
                <Text style={gridStyles.headerTextButtonLabel}>
                  {allSelected ? 'Deselect' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => navigation.goBack()} style={gridStyles.headerLeft}>
                <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={gridStyles.title} numberOfLines={1}>
                {isAllPhotos ? 'All Photos' : albumName}
              </Text>
              <View style={gridStyles.headerRight}>
                {!isAllPhotos && (
                  <TouchableOpacity onPress={handleAddPhotos} style={gridStyles.iconButton}>
                    <Ionicons name="add" size={26} color="white" />
                  </TouchableOpacity>
                )}
                {albumPhotos.length > 0 && (
                  <TouchableOpacity onPress={() => setSelecting(true)} style={gridStyles.iconButton}>
                    <Text style={gridStyles.selectButtonText}>Select</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
        <Text style={gridStyles.countText}>
          {albumPhotos.length} {albumPhotos.length === 1 ? 'photo' : 'photos'}
        </Text>
      </View>

      <FlatList
        data={albumPhotos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentContainerStyle={{
          padding: SPACING,
          paddingBottom: selecting ? insets.bottom + 80 : insets.bottom + 20,
        }}
        columnWrapperStyle={gridStyles.row}
        ListEmptyComponent={
          <View style={gridStyles.emptyContainer}>
            <Ionicons name="images-outline" size={48} color="#555" />
            <Text style={gridStyles.emptyText}>No photos in this album</Text>
            {!isAllPhotos && (
              <TouchableOpacity style={gridStyles.emptyAddButton} onPress={handleAddPhotos}>
                <Text style={gridStyles.emptyAddText}>Add Photos</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Bottom toolbar when selecting */}
      {selecting && (
        <View style={[gridStyles.toolbar, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity
            style={[
              gridStyles.trashButton,
              selectedIds.size === 0 && gridStyles.trashButtonDisabled,
            ]}
            onPress={handleDeleteSelected}
            disabled={selectedIds.size === 0}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={selectedIds.size === 0 ? '#555' : '#ff453a'}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const gridStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  headerContainer: {
    backgroundColor: '#0a0f1a',
    paddingHorizontal: 16,
    paddingBottom: 6,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  headerLeft: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  headerRight: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  iconButton: {
    height: 44,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectButtonText: {
    color: '#4a9eff',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTextButtonLabel: {
    color: '#4a9eff',
    fontSize: 15,
    fontWeight: '600',
  },
  countText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  row: {
    justifyContent: 'flex-start',
    marginBottom: SPACING,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginHorizontal: SPACING / 2,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  scoreBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#4a9eff',
    borderColor: '#4a9eff',
  },
  toolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111827',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 10,
  },
  trashButton: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashButtonDisabled: {
    opacity: 0.4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  emptyAddButton: {
    marginTop: 8,
    backgroundColor: '#1a2535',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyAddText: {
    color: '#4a9eff',
    fontSize: 15,
    fontWeight: '600',
  },
});

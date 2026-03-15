import React, { useMemo } from 'react';
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
import { useGallery } from '../hooks';
import { useAlbums, addPhotosToAlbum, removePhotosFromAlbum } from '../hooks/useAlbums';
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

  const album = albums.find((a) => a.id === albumId);
  const photoIdSet = useMemo(() => new Set(album?.photoIds ?? []), [album?.photoIds]);

  // "All Photos" is a virtual album showing everything
  const isAllPhotos = albumId === '__all__';
  const albumPhotos = useMemo(() => {
    if (isAllPhotos) return photos;
    return photos.filter((p) => photoIdSet.has(p.id));
  }, [isAllPhotos, photos, photoIdSet]);

  const handlePhotoPress = (photo: PhotoAsset, index: number) => {
    (navigation as any).navigate('ImageViewer', {
      imageUri: photo.uri,
      allPhotos: albumPhotos.map((p) => p.uri),
      initialIndex: index,
    });
  };

  const handleAddPhotos = () => {
    (navigation as any).navigate('PhotoPicker', { albumId });
  };

  const renderPhoto = ({ item, index }: { item: PhotoAsset; index: number }) => (
    <TouchableOpacity
      style={gridStyles.photoItem}
      onPress={() => handlePhotoPress(item, index)}
    >
      <Image source={{ uri: item.uri }} style={gridStyles.photoImage} contentFit="cover" />
    </TouchableOpacity>
  );

  return (
    <View style={gridStyles.container}>
      {/* Header */}
      <View style={[gridStyles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={gridStyles.backButton}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={gridStyles.title} numberOfLines={1}>
          {isAllPhotos ? 'All Photos' : albumName}
        </Text>
        {!isAllPhotos ? (
          <TouchableOpacity onPress={handleAddPhotos} style={gridStyles.addButton}>
            <Ionicons name="add" size={26} color="white" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <Text style={gridStyles.countText}>
        {albumPhotos.length} {albumPhotos.length === 1 ? 'photo' : 'photos'}
      </Text>

      <FlatList
        data={albumPhotos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentContainerStyle={{
          padding: SPACING,
          paddingBottom: insets.bottom + 20,
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
    </View>
  );
};

const gridStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
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

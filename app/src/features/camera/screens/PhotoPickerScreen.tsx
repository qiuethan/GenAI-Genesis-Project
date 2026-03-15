import React, { useState, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useGallery } from '../hooks';
import { useAlbums, addPhotosToAlbum } from '../hooks/useAlbums';
import { PhotoAsset } from '../../../infra/mediaLibrary';

const { width } = Dimensions.get('window');
const COLUMNS = 3;
const SPACING = 2;
const ITEM_SIZE = (width - SPACING * (COLUMNS + 1)) / COLUMNS;

export const PhotoPickerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { albumId } = route.params as { albumId: string };
  const { photos } = useGallery(100);
  const { albums, refresh } = useAlbums();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const album = albums.find((a) => a.id === albumId);
  const existingIds = useMemo(() => new Set(album?.photoIds ?? []), [album?.photoIds]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = async () => {
    if (selected.size === 0) {
      navigation.goBack();
      return;
    }
    await addPhotosToAlbum(albumId, Array.from(selected));
    refresh();
    navigation.goBack();
  };

  const renderPhoto = ({ item }: { item: PhotoAsset }) => {
    const isSelected = selected.has(item.id);
    const alreadyInAlbum = existingIds.has(item.id);

    return (
      <TouchableOpacity
        style={pickerStyles.photoItem}
        onPress={() => !alreadyInAlbum && toggleSelect(item.id)}
        activeOpacity={alreadyInAlbum ? 1 : 0.7}
      >
        <Image source={{ uri: item.uri }} style={pickerStyles.photoImage} contentFit="cover" />
        {alreadyInAlbum && (
          <View style={pickerStyles.overlay}>
            <Ionicons name="checkmark-circle" size={28} color="#4a9eff" />
          </View>
        )}
        {isSelected && !alreadyInAlbum && (
          <View style={pickerStyles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={28} color="#4aff6e" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={pickerStyles.container}>
      <View style={[pickerStyles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={pickerStyles.cancelButton}>
          <Text style={pickerStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={pickerStyles.title}>Add Photos</Text>
        <TouchableOpacity onPress={handleDone} style={pickerStyles.doneButton}>
          <Text style={[pickerStyles.doneText, selected.size === 0 && { opacity: 0.4 }]}>
            Add{selected.size > 0 ? ` (${selected.size})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentContainerStyle={{
          padding: SPACING,
          paddingBottom: insets.bottom + 20,
        }}
        columnWrapperStyle={pickerStyles.row}
      />
    </View>
  );
};

const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  cancelButton: {
    width: 70,
  },
  cancelText: {
    color: '#888',
    fontSize: 16,
  },
  title: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  doneButton: {
    width: 70,
    alignItems: 'flex-end',
  },
  doneText: {
    color: '#4a9eff',
    fontSize: 16,
    fontWeight: '600',
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

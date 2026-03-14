import React from 'react';
import { View, FlatList, Image, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { IconButton } from '../components/IconButton';
import { useGallery } from '../hooks';
import { PhotoAsset } from '../../../infra/mediaLibrary';
import { galleryStyles as styles, GALLERY_CONSTANTS } from '../styles/GalleryScreen.styles';

const { COLUMNS } = GALLERY_CONSTANTS;

export const GalleryScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { photos, loading } = useGallery(100);

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

  const renderPhoto = ({ item, index }: { item: PhotoAsset; index: number }) => (
    <TouchableOpacity
      style={styles.photoItem}
      onPress={() => handlePhotoPress(item, index)}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.photoImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

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
            paddingBottom: insets.bottom + 80 
          }
        ]}
        columnWrapperStyle={styles.row}
      />

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
        {/* Placeholder for future controls */}
      </View>
    </View>
  );
};

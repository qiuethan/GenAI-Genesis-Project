import React, { useState, useRef } from 'react';
import { View, FlatList, ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { IconButton } from '../components/IconButton';
import { imageViewerStyles as styles, IMAGE_VIEWER_CONSTANTS } from '../styles';
import { CameraStackParamList } from '../types';

const { SCREEN_WIDTH } = IMAGE_VIEWER_CONSTANTS;

type ImageViewerRouteProp = RouteProp<CameraStackParamList, 'ImageViewer'>;

export const ImageViewerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<ImageViewerRouteProp>();
  const insets = useSafeAreaInsets();
  const { imageUri, allPhotos, initialIndex = 0 } = route.params;
  
  const photos = allPhotos || [imageUri];
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  const handleClose = () => {
    navigation.goBack();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderPhoto = ({ item }: { item: string }) => (
    <View style={styles.photoContainer}>
      <Image
        source={{ uri: item }}
        style={styles.image}
        contentFit="contain"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item, index) => `${item}-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
      
      {/* Close Button */}
      <View style={[styles.closeButton, { top: insets.top + 10 }]}>
        <View style={styles.iconButtonBg}>
          <IconButton 
            iconName="chevron-back" 
            size={20} 
            onPress={handleClose}
            color="white"
          />
        </View>
      </View>
    </View>
  );
};

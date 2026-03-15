import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type PhotoViewerParams = {
  PhotoViewer: { uri: string };
};

type PhotoViewerRouteProp = RouteProp<PhotoViewerParams, 'PhotoViewer'>;

export function PhotoViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute<PhotoViewerRouteProp>();
  const insets = useSafeAreaInsets();
  const { uri } = route.params;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="contain"
      />
      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 10 }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <View style={styles.closeButtonBg}>
          <Ionicons name="close" size={22} color="#fff" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  closeButtonBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(50, 50, 50, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

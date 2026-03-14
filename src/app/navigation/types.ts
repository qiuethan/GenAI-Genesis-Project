/**
 * Navigation Type Definitions
 * Centralized navigation types for type-safe navigation
 */

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

// Root stack param list
export type RootStackParamList = {
  Camera: undefined;
  Gallery: undefined;
  ImageViewer: {
    imageUri: string;
    allPhotos?: string[];
    initialIndex?: number;
  };
};

// Navigation prop types for each screen
export type CameraScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera'>;
export type GalleryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Gallery'>;
export type ImageViewerScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ImageViewer'>;

// Route prop types for each screen
export type CameraScreenRouteProp = RouteProp<RootStackParamList, 'Camera'>;
export type GalleryScreenRouteProp = RouteProp<RootStackParamList, 'Gallery'>;
export type ImageViewerScreenRouteProp = RouteProp<RootStackParamList, 'ImageViewer'>;

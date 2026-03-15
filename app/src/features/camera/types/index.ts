/**
 * Camera Feature Type Definitions
 * Centralized types for the camera feature module
 */

// Aspect ratio options for camera capture
export type AspectRatio = '4:3' | '16:9' | '1:1';

// Photo asset representation (abstracted from MediaLibrary)
export interface PhotoAsset {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  creationTime?: number;
}

// Gallery state
export interface GalleryState {
  photos: PhotoAsset[];
  loading: boolean;
  hasPermission: boolean;
  error: string | null;
}

// Camera state
export interface CameraState {
  position: 'front' | 'back';
  aspectRatio: AspectRatio;
  isMenuOpen: boolean;
  lastPhoto: string | null;
}

// Image viewer navigation params
export interface ImageViewerParams {
  imageUri: string;
  allPhotos?: string[];
  allPhotoIds?: string[];
  initialIndex?: number;
}

// Navigation param list for type-safe navigation
export type CameraStackParamList = {
  Camera: undefined;
  Gallery: undefined;
  AlbumDetail: { albumId: string; albumName: string };
  PhotoPicker: { albumId: string };
  ImageViewer: ImageViewerParams;
};

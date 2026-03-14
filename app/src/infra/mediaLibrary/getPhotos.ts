import * as MediaLibrary from 'expo-media-library';

/**
 * Photo asset representation - abstracted from MediaLibrary.Asset
 */
export interface PhotoAsset {
  id: string;
  uri: string;
  width: number;
  height: number;
  creationTime: number;
}

export interface GetPhotosOptions {
  first?: number;
  after?: string;
}

export interface GetPhotosResult {
  assets: PhotoAsset[];
  hasNextPage: boolean;
  endCursor?: string;
}

/**
 * Request media library permission
 */
export const requestMediaPermission = async (): Promise<boolean> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
};

/**
 * Get photos from device library
 * Abstracts expo-media-library to provide a clean interface
 */
export const getPhotos = async (
  options: GetPhotosOptions = {}
): Promise<GetPhotosResult | null> => {
  const hasPermission = await requestMediaPermission();
  
  if (!hasPermission) {
    return null;
  }

  try {
    const { first = 100, after } = options;
    
    const result = await MediaLibrary.getAssetsAsync({
      first,
      after,
      mediaType: 'photo',
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });

    // asset.uri is ph:// — expo-image's <Image> can load these directly,
    // so no need to call getAssetInfoAsync for each photo.
    const assets: PhotoAsset[] = result.assets.map((asset) => ({
      id: asset.id,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      creationTime: asset.creationTime,
    }));

    return {
      assets,
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
    };
  } catch (error) {
    console.error('Failed to get photos:', error);
    return null;
  }
};

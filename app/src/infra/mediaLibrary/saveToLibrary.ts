import * as MediaLibrary from 'expo-media-library';

/**
 * Save a photo to the device library.
 * Returns the created asset (with id and uri) so it can be scored.
 */
export const saveToLibrary = async (localUri: string): Promise<MediaLibrary.Asset> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission not granted');
  }
  return await MediaLibrary.createAssetAsync(localUri);
};

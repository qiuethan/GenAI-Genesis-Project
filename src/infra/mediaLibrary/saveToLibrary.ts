import * as MediaLibrary from 'expo-media-library';

export const saveToLibrary = async (localUri: string) => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission not granted');
  }
  await MediaLibrary.saveToLibraryAsync(localUri);
};

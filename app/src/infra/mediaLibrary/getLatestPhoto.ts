import * as MediaLibrary from 'expo-media-library';

export const getLatestPhoto = async (): Promise<string | null> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await MediaLibrary.getAssetsAsync({
    first: 1,
    mediaType: 'photo',
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });

  if (result.assets.length === 0) return null;

  // asset.uri is ph:// — expo-image's <Image> can load these directly.
  return result.assets[0].uri;
};

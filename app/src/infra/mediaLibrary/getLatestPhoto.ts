import * as MediaLibrary from 'expo-media-library';

export const getLatestPhoto = async (): Promise<string | null> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  const albums = await MediaLibrary.getAlbumsAsync();
  const cameraRoll = albums.find(album => album.title === 'Camera' || album.title === 'Recents');
  
  if (!cameraRoll) {
    const allPhotos = await MediaLibrary.getAssetsAsync({
      first: 1,
      mediaType: 'photo',
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    
    if (allPhotos.assets.length > 0) {
      return allPhotos.assets[0].uri;
    }
    return null;
  }

  const assets = await MediaLibrary.getAssetsAsync({
    album: cameraRoll,
    first: 1,
    mediaType: 'photo',
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });

  if (assets.assets.length > 0) {
    return assets.assets[0].uri;
  }

  return null;
};

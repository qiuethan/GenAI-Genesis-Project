import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const imageViewerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  photoContainer: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  iconButtonBg: {
    backgroundColor: 'rgba(50,50,50,0.7)',
    borderRadius: 30,
    padding: 8,
  },
});

export const IMAGE_VIEWER_CONSTANTS = {
  SCREEN_WIDTH: width,
  SCREEN_HEIGHT: height,
};

import { StyleSheet } from 'react-native';

export const cameraStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'white',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 20,
    paddingBottom: 4,
  },
  topLeftFlash: {
    position: 'absolute',
    left: 20,
  },
  topRightRatio: {
    position: 'absolute',
    right: 20,
  },
  chevronContainer: {},
  bottomBar: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  controlsBackground: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  menuContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
  },
  flashContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flashContainerColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  indicatorText: {
    color: '#ffe81f',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 0,
  },
  zoomContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    zIndex: 20,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonActive: {
    backgroundColor: '#ffe81f',
  },
  zoomButtonDynamic: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  zoomText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  zoomTextActive: {
    color: 'black',
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  sideButton: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailFrame: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'white',
    overflow: 'hidden',
    backgroundColor: 'black',
  },
  thumbnailImage: {
    width: 48,
    height: 48,
  },
  iconButtonBg: {
    backgroundColor: 'rgba(50,50,50,0.5)',
    borderRadius: 30,
    padding: 6,
  },
  modeTextWrapper: {
    marginBottom: 8,
  },
  modeText: {
    color: '#ffe81f',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  zoomIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

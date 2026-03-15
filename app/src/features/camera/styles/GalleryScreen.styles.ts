import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const COLUMNS = 3;
const SPACING = 2;
const ITEM_SIZE = (width - (SPACING * (COLUMNS + 1))) / COLUMNS;

export const galleryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  gridContainer: {
    padding: SPACING,
  },
  row: {
    justifyContent: 'flex-start',
    marginBottom: SPACING,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginHorizontal: SPACING / 2,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
});

export const GALLERY_CONSTANTS = {
  COLUMNS,
  SPACING,
  ITEM_SIZE,
};

import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const SECTION_PADDING = 16;
const ALBUM_CARD_WIDTH = (width - SECTION_PADDING * 2 - 12) / 2;
const ALBUM_CARD_HEIGHT = ALBUM_CARD_WIDTH * 1.1;
const CATEGORY_CARD_WIDTH = (width - SECTION_PADDING * 2 - 12) / 2.2;
const CATEGORY_CARD_HEIGHT = CATEGORY_CARD_WIDTH * 1.2;

export const galleryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0a0f1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Sticky Header
  headerContainer: {
    backgroundColor: '#0a0f1a',
    paddingHorizontal: SECTION_PADDING,
    paddingBottom: 6,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 170, 0, 0.15)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  headerIconButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a2030',
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a2535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SECTION_PADDING,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#ffaa00',
    fontSize: 16,
    fontWeight: '700',
  },
  seeAllText: {
    color: '#4a9eff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Album cards
  albumList: {
    paddingLeft: SECTION_PADDING,
    paddingRight: 4,
  },
  albumCard: {
    width: ALBUM_CARD_WIDTH,
    height: ALBUM_CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  albumImage: {
    width: '100%',
    height: '100%',
  },
  albumLabelContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  albumLabel: {
    backgroundColor: 'rgba(120, 120, 120, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  albumLabelText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  albumPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a2030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumCountContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#ffaa00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  albumCountText: {
    color: '#1a1000',
    fontSize: 12,
    fontWeight: '700',
  },

  // Category cards
  categoryList: {
    paddingLeft: SECTION_PADDING,
    paddingRight: 4,
  },
  categoryCard: {
    width: CATEGORY_CARD_WIDTH,
    height: CATEGORY_CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryLabelContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  categoryLabel: {
    backgroundColor: 'rgba(120, 120, 120, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  categoryLabelText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },

  // Utilities
  utilitiesSection: {
    paddingHorizontal: SECTION_PADDING,
    marginTop: 8,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  utilityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1a2030',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 0, 0.3)',
  },
  utilityLabel: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export const GALLERY_CONSTANTS = {
  SECTION_PADDING,
  ALBUM_CARD_WIDTH,
  ALBUM_CARD_HEIGHT,
  CATEGORY_CARD_WIDTH,
  CATEGORY_CARD_HEIGHT,
};

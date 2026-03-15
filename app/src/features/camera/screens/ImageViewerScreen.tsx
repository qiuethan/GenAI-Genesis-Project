import React, { useState, useRef, useCallback } from 'react';
import { View, Image, FlatList, ViewToken, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import { IconButton } from '../components/IconButton';
import { imageViewerStyles as styles, IMAGE_VIEWER_CONSTANTS } from '../styles';
import { CameraStackParamList } from '../types';
import { getServerUrl } from '../../../infra/network/serverUrl';
import { useGalleryScores, scorePhoto, scoreToColor } from '../hooks';

const { SCREEN_WIDTH } = IMAGE_VIEWER_CONSTANTS;

type ImageViewerRouteProp = RouteProp<CameraStackParamList, 'ImageViewer'>;

export const ImageViewerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<ImageViewerRouteProp>();
  const insets = useSafeAreaInsets();
  const { imageUri, allPhotos, allPhotoIds, initialIndex = 0 } = route.params;

  const photos = allPhotos || [imageUri];
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  // Score state
  const { scores } = useGalleryScores();
  const [scoringIndex, setScoringIndex] = useState<number | null>(null);

  // Composition analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [compositionInfo, setCompositionInfo] = useState<{ type: string; score: number } | null>(null);
  const [showAnnotated, setShowAnnotated] = useState(false);

  const currentPhotoId = allPhotoIds?.[currentIndex];
  const currentScore = currentPhotoId ? scores[currentPhotoId] : undefined;
  const isScoring = scoringIndex === currentIndex;

  const handleClose = () => {
    navigation.goBack();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
      // Clear analysis when swiping to a different photo
      setAnnotatedImage(null);
      setCompositionInfo(null);
      setShowAnnotated(false);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleScore = useCallback(async () => {
    if (!currentPhotoId || isScoring) return;
    setScoringIndex(currentIndex);
    try {
      await scorePhoto(currentPhotoId, photos[currentIndex]);
    } catch {}
    setScoringIndex(null);
  }, [currentPhotoId, currentIndex, photos, isScoring]);

  const handleAnalyze = useCallback(async () => {
    const photoUri = photos[currentIndex];
    if (!photoUri || analyzing) return;

    setAnalyzing(true);
    setAnnotatedImage(null);
    setCompositionInfo(null);

    try {
      // Resize to reasonable size for Gemini
      const processed = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      const blob = await fetch(processed.uri).then(r => r.blob());
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${getServerUrl()}/analyze-composition`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error('Analyze composition failed:', response.status);
        return;
      }

      const data = await response.json();

      if (data.annotated_image) {
        setAnnotatedImage(`data:image/jpeg;base64,${data.annotated_image}`);
        setCompositionInfo({
          type: data.composition_type || 'Unknown',
          score: data.composition_score ?? 0,
        });
        setShowAnnotated(true);
      }
    } catch (e) {
      console.error('Analyze composition error:', e);
    } finally {
      setAnalyzing(false);
    }
  }, [currentIndex, photos, analyzing]);

  const renderPhoto = ({ item }: { item: string }) => (
    <View style={styles.photoContainer}>
      <Image
        source={{ uri: item }}
        style={styles.image}
        contentFit="contain"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Original photos */}
      <FlatList
        ref={flatListRef}
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item, index) => `${item}-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Annotated image overlay */}
      {showAnnotated && annotatedImage && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowAnnotated(false)}
        >
          <Image
            source={{ uri: annotatedImage }}
            style={{ flex: 1 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}

      {/* Composition info pill */}
      {compositionInfo && (
        <View style={[analyzeStyles.infoPill, { top: insets.top + 60 }]}>
          <Text style={analyzeStyles.infoType}>{compositionInfo.type}</Text>
          <Text style={[analyzeStyles.infoScore, { color: scoreToColor(compositionInfo.score) }]}>
            {Math.round(compositionInfo.score)}
          </Text>
        </View>
      )}

      {/* Score pill (when scored) */}
      {currentScore && !showAnnotated && (
        <View style={[scoreStyles.pillContainer, { bottom: insets.bottom + 130 }]}>
          <View style={[scoreStyles.scorePill, { backgroundColor: scoreToColor(currentScore.aesthetic_score) }]}>
            <Text style={scoreStyles.scorePillText}>{Math.round(currentScore.aesthetic_score)}</Text>
          </View>
          {currentScore.composition_score != null && (
            <View style={[scoreStyles.scorePill, { backgroundColor: scoreToColor(currentScore.composition_score) }]}>
              <Text style={scoreStyles.scorePillText}>{Math.round(currentScore.composition_score)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Score button (when unscored and has photo ID) */}
      {!currentScore && currentPhotoId && !showAnnotated && (
        <View style={[scoreStyles.buttonContainer, { bottom: insets.bottom + 130 }]}>
          <TouchableOpacity
            style={scoreStyles.scoreButton}
            onPress={handleScore}
            disabled={isScoring}
          >
            {isScoring ? (
              <>
                <ActivityIndicator color="#000" size="small" />
                <Text style={scoreStyles.scoreButtonText}>Scoring...</Text>
              </>
            ) : (
              <Text style={scoreStyles.scoreButtonText}>Score</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Toggle button when annotated image exists */}
      {annotatedImage && !analyzing && (
        <View style={[analyzeStyles.toggleContainer, { bottom: insets.bottom + 80 }]}>
          <TouchableOpacity
            style={analyzeStyles.toggleButton}
            onPress={() => setShowAnnotated(!showAnnotated)}
          >
            <Text style={analyzeStyles.toggleText}>
              {showAnnotated ? 'Show Original' : 'Show Composition'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Close Button */}
      <View style={[styles.closeButton, { top: insets.top + 10 }]}>
        <View style={styles.iconButtonBg}>
          <IconButton
            iconName="chevron-back"
            size={20}
            onPress={handleClose}
            color="white"
          />
        </View>
      </View>

      {/* Analyze Composition Button */}
      <View style={[analyzeStyles.buttonContainer, { bottom: insets.bottom + 30 }]}>
        <TouchableOpacity
          style={analyzeStyles.analyzeButton}
          onPress={handleAnalyze}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={analyzeStyles.analyzeButtonText}>
              {annotatedImage ? 'Re-analyze' : 'Analyze Composition'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const scoreStyles = StyleSheet.create({
  buttonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scoreButton: {
    backgroundColor: '#ffe81f',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  pillContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  scorePill: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
  },
  scorePillText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

const analyzeStyles = StyleSheet.create({
  buttonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  analyzeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  infoPill: {
    position: 'absolute',
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  infoType: {
    color: '#aaa',
    fontSize: 10,
    fontWeight: '600',
  },
  infoScore: {
    fontSize: 16,
    fontWeight: '700',
  },
  toggleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

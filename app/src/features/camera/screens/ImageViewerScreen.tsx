import React, { useState, useRef, useCallback } from 'react';
import { View, FlatList, ViewToken, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { IconButton } from '../components/IconButton';
import { imageViewerStyles as styles, IMAGE_VIEWER_CONSTANTS } from '../styles';
import { CameraStackParamList } from '../types';
import { removePhotosFromAlbum } from '../hooks/useAlbums';
import { getServerUrl } from '../../../infra/network/serverUrl';
import { useGalleryScores, scorePhoto, scoreToColor, removeScores, cacheScore } from '../hooks';
import type { GalleryScore } from '../hooks';

const { SCREEN_WIDTH } = IMAGE_VIEWER_CONSTANTS;

type ImageViewerRouteProp = RouteProp<CameraStackParamList, 'ImageViewer'>;

export const ImageViewerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<ImageViewerRouteProp>();
  const insets = useSafeAreaInsets();
  const { imageUri, allPhotos, allPhotoIds, initialIndex = 0, albumId } = route.params;

  const [photos, setPhotos] = useState(allPhotos || [imageUri]);
  const [photoIds, setPhotoIds] = useState(allPhotoIds || []);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  // Score state
  const { scores } = useGalleryScores();
  const [scoringIndex, setScoringIndex] = useState<number | null>(null);

  // Composition analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    type: string;
    aesthetic_score: number;
    composition_score: number;
    strengths: string[];
    improvements: string[];
    summary: string;
  } | null>(null);
  const [showAnnotated, setShowAnnotated] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const currentPhotoId = allPhotoIds?.[currentIndex];
  const currentScore = currentPhotoId ? scores[currentPhotoId] : undefined;
  const isScoring = scoringIndex === currentIndex;

  const handleClose = () => {
    navigation.goBack();
  };

  const isAllPhotos = albumId === '__all__';

  const handleDelete = () => {
    const currentPhotoId = photoIds[currentIndex];
    if (!currentPhotoId) return;

    const title = isAllPhotos ? 'Delete Photo' : 'Remove Photo';
    const message = isAllPhotos
      ? 'Delete this photo from your device?'
      : 'Remove this photo from this album?';
    const action = isAllPhotos ? 'Delete' : 'Remove';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: 'destructive',
        onPress: async () => {
          if (isAllPhotos) {
            try {
              await MediaLibrary.deleteAssetsAsync([currentPhotoId]);
              await removeScores([currentPhotoId]);
            } catch {}
          } else if (albumId) {
            await removePhotosFromAlbum(albumId, [currentPhotoId]);
          }

          const remaining = photos.length - 1;
          if (remaining <= 0) {
            navigation.goBack();
            return;
          }

          // Remove from local arrays
          const newPhotos = [...photos];
          const newIds = [...photoIds];
          newPhotos.splice(currentIndex, 1);
          newIds.splice(currentIndex, 1);

          // Move to previous photo, or stay if at start
          const newIndex = currentIndex >= remaining ? remaining - 1 : currentIndex;

          setPhotos(newPhotos);
          setPhotoIds(newIds);
          setCurrentIndex(newIndex);
          setAnnotatedImage(null);
          setAnalysis(null);
          setShowAnnotated(false);
          setShowAnalysis(false);

          // Scroll to the correct position
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: newIndex, animated: false });
          }, 50);
        },
      },
    ]);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
      // Clear analysis when swiping to a different photo
      setAnnotatedImage(null);
      setAnalysis(null);
      setShowAnnotated(false);
      setShowAnalysis(false);
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
    const photoId = photoIds[currentIndex];
    if (!photoUri || analyzing) return;

    setAnalyzing(true);
    setAnnotatedImage(null);
    setAnalysis(null);
    setShowAnnotated(false);
    setShowAnalysis(false);

    try {
      const processed = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      const blob = await fetch(processed.uri).then(r => r.blob());

      // Run both endpoints in parallel:
      // 1. /analyze-interactive — structured analysis + scores from SAMP-Net + Gemini
      // 2. /analyze-composition — annotated image with drawn guide lines
      const baseUrl = getServerUrl();
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const timeout1 = setTimeout(() => controller1.abort(), 45000);
      const timeout2 = setTimeout(() => controller2.abort(), 45000);

      const [interactiveRes, compositionRes] = await Promise.allSettled([
        fetch(`${baseUrl}/analyze-interactive`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
          signal: controller1.signal,
        }),
        fetch(`${baseUrl}/analyze-composition`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
          signal: controller2.signal,
        }),
      ]);

      clearTimeout(timeout1);
      clearTimeout(timeout2);

      // Process interactive analysis (scores + structured feedback)
      if (interactiveRes.status === 'fulfilled' && interactiveRes.value.ok) {
        const data = await interactiveRes.value.json();
        const aes = data.aesthetic_score ?? 0;
        const comp = data.composition_score ?? 0;
        const geminiAnalysis = data.analysis ?? {};

        setAnalysis({
          type: data.composition_type ?? 'Unknown',
          aesthetic_score: aes,
          composition_score: comp,
          strengths: geminiAnalysis.strengths ?? [],
          improvements: geminiAnalysis.improvements ?? [],
          summary: geminiAnalysis.summary ?? '',
        });
        setShowAnalysis(true);

        // Update score cache so gallery reflects the new scores
        if (photoId) {
          await scorePhoto(photoId, photoUri, true);
        }
      }

      // Process composition overlay image
      if (compositionRes.status === 'fulfilled' && compositionRes.value.ok) {
        const data = await compositionRes.value.json();
        if (data.annotated_image) {
          setAnnotatedImage(`data:image/jpeg;base64,${data.annotated_image}`);
          setShowAnnotated(true);
        }
      }
    } catch (e) {
      console.error('Analyze error:', e);
    } finally {
      setAnalyzing(false);
    }
  }, [currentIndex, photos, photoIds, analyzing]);

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

      {/* Full-screen analysis overlay */}
      {(showAnnotated || showAnalysis) && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }]}>
          {/* Annotated image as background */}
          {annotatedImage && showAnnotated && (
            <Image
              source={{ uri: annotatedImage }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
          )}

          {/* Original image as background when showing text analysis */}
          {showAnalysis && !showAnnotated && (
            <>
              <Image
                source={{ uri: photos[currentIndex] }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
            </>
          )}

          {/* Analysis text panel */}
          {showAnalysis && analysis && !showAnnotated && (
            <View style={[analyzeStyles.analysisPanel, { top: insets.top + 60, bottom: insets.bottom + 80 }]}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={analyzeStyles.analysisPanelContent}>
                <Text style={analyzeStyles.analysisType}>{analysis.type}</Text>
                <View style={analyzeStyles.analysisScores}>
                  <View style={analyzeStyles.analysisScoreItem}>
                    <Text style={analyzeStyles.analysisScoreLabel}>Aesthetic</Text>
                    <Text style={[analyzeStyles.analysisScoreValue, { color: scoreToColor(analysis.aesthetic_score) }]}>
                      {Math.round(analysis.aesthetic_score)}
                    </Text>
                  </View>
                  <View style={analyzeStyles.analysisScoreItem}>
                    <Text style={analyzeStyles.analysisScoreLabel}>Composition</Text>
                    <Text style={[analyzeStyles.analysisScoreValue, { color: scoreToColor(analysis.composition_score) }]}>
                      {Math.round(analysis.composition_score)}
                    </Text>
                  </View>
                </View>
                {analysis.summary !== '' && (
                  <Text style={analyzeStyles.analysisSummary}>{analysis.summary}</Text>
                )}
                {analysis.strengths.length > 0 && (
                  <View style={analyzeStyles.analysisSection}>
                    <Text style={analyzeStyles.analysisSectionTitle}>Strengths</Text>
                    {analysis.strengths.map((s, i) => (
                      <Text key={i} style={analyzeStyles.analysisBullet}>+ {s}</Text>
                    ))}
                  </View>
                )}
                {analysis.improvements.length > 0 && (
                  <View style={analyzeStyles.analysisSection}>
                    <Text style={analyzeStyles.analysisSectionTitle}>Improve</Text>
                    {analysis.improvements.map((s, i) => (
                      <Text key={i} style={analyzeStyles.analysisBullet}>- {s}</Text>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* Back button on overlay */}
          <View style={[styles.closeButton, { top: insets.top + 10 }]}>
            <View style={styles.iconButtonBg}>
              <IconButton
                iconName="chevron-back"
                size={20}
                onPress={() => { setShowAnnotated(false); setShowAnalysis(false); }}
                color="white"
              />
            </View>
          </View>

          {/* Toggle between lines / analysis */}
          {(annotatedImage || analysis) && (
            <View style={[analyzeStyles.toggleContainer, { bottom: insets.bottom + 30 }]}>
              {annotatedImage && (
                <TouchableOpacity
                  style={[analyzeStyles.toggleButton, showAnnotated && analyzeStyles.toggleButtonActive]}
                  onPress={() => { setShowAnnotated(true); setShowAnalysis(false); }}
                >
                  <Text style={analyzeStyles.toggleText}>Lines</Text>
                </TouchableOpacity>
              )}
              {analysis && (
                <TouchableOpacity
                  style={[analyzeStyles.toggleButton, showAnalysis && !showAnnotated && analyzeStyles.toggleButtonActive]}
                  onPress={() => { setShowAnalysis(true); setShowAnnotated(false); }}
                >
                  <Text style={analyzeStyles.toggleText}>Analysis</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Score (bottom-right) */}
      {!showAnnotated && currentPhotoId && (
        <View style={[scoreStyles.container, { bottom: insets.bottom + 30 }]}>
          {currentScore ? (
            <View style={scoreStyles.row}>
              <View style={[scoreStyles.pill, { borderColor: scoreToColor(currentScore.combined_score) }]}>
                <Text style={[scoreStyles.pillText, { color: scoreToColor(currentScore.combined_score) }]}>
                  {Math.round(currentScore.combined_score)}
                </Text>
              </View>
              <View style={scoreStyles.subRow}>
                <View style={[scoreStyles.subPill, { borderColor: scoreToColor(currentScore.aesthetic_score) }]}>
                  <Text style={[scoreStyles.subPillText, { color: scoreToColor(currentScore.aesthetic_score) }]}>
                    {Math.round(currentScore.aesthetic_score)}
                  </Text>
                </View>
                {currentScore.composition_score != null && (
                  <View style={[scoreStyles.subPill, { borderColor: scoreToColor(currentScore.composition_score) }]}>
                    <Text style={[scoreStyles.subPillText, { color: scoreToColor(currentScore.composition_score) }]}>
                      {Math.round(currentScore.composition_score)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={scoreStyles.scoreButton}
              onPress={handleScore}
              disabled={isScoring}
            >
              {isScoring ? (
                <ActivityIndicator color="#aaa" size="small" />
              ) : (
                <IconButton iconName="sparkles" size={20} onPress={handleScore} color="#aaa" />
              )}
            </TouchableOpacity>
          )}
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

      {/* Trash Button */}
      {photoIds.length > 0 && (
        <View style={[trashStyles.button, { top: insets.top + 10 }]}>
          <View style={styles.iconButtonBg}>
            <IconButton
              iconName="trash-outline"
              size={20}
              onPress={handleDelete}
              color="white"
            />
          </View>
        </View>
      )}

      {/* Analyze Composition Button */}
      {!showAnnotated && !showAnalysis && (
        <View style={[analyzeStyles.buttonContainer, { bottom: insets.bottom + 30 }]}>
          {analysis || annotatedImage ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={analyzeStyles.analyzeButton}
                onPress={() => { setShowAnnotated(!!annotatedImage); setShowAnalysis(!annotatedImage); }}
              >
                <Text style={analyzeStyles.analyzeButtonText}>View Analysis</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[analyzeStyles.analyzeButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                onPress={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={analyzeStyles.analyzeButtonText}>Re-analyze</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={analyzeStyles.analyzeButton}
              onPress={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={analyzeStyles.analyzeButtonText}>Analyze</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const scoreStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  row: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    backgroundColor: 'rgba(50,50,50,0.7)',
    borderRadius: 30,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  subRow: {
    flexDirection: 'row',
    gap: 4,
  },
  subPill: {
    backgroundColor: 'rgba(50,50,50,0.7)',
    borderRadius: 30,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  subPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  scoreButton: {
    backgroundColor: 'rgba(50,50,50,0.7)',
    borderRadius: 30,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const trashStyles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
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
  analysisPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  analysisPanelContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  analysisType: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  analysisScores: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  analysisScoreItem: {
    alignItems: 'center',
    gap: 2,
  },
  analysisScoreLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '600',
  },
  analysisScoreValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  analysisSummary: {
    color: '#ccc',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  analysisSection: {
    gap: 3,
  },
  analysisSectionTitle: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  analysisBullet: {
    color: '#ccc',
    fontSize: 12,
    lineHeight: 17,
  },
  toggleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  toggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  toggleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

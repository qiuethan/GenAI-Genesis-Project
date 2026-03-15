import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { CompositionResult } from '../hooks/useCompositionScore';
import { RotatableView } from './RotatableView';

interface Props {
  result: CompositionResult | null;
  connected: boolean;
  rotation?: 0 | 90 | 180 | 270;
  cameraFrameTop: number;
  compositionTypeName?: string | null;
}

const scoreToColor = (score: number): string => {
  const t = Math.max(0, Math.min(1, score / 100));
  if (t < 0.25) return '#ff4444';
  if (t < 0.5) return '#ff9900';
  if (t < 0.75) return '#aacc00';
  return '#44cc44';
};

export const CompositionScoreOverlay: React.FC<Props> = ({
  result,
  connected,
  rotation = 0,
  cameraFrameTop,
  compositionTypeName,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasShown = useRef(false);

  useEffect(() => {
    if (result && !hasShown.current) {
      hasShown.current = true;
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [result]);

  if (!result && !connected) return null;

  const aestheticScore = result ? (result.aesthetic_score ?? result.score ?? 0) : 0;
  const aestheticColor = result ? scoreToColor(aestheticScore) : '#888';
  const compositionColor = result?.composition_score != null
    ? scoreToColor(result.composition_score)
    : '#888';

  return (
    <View
      style={[styles.container, { top: cameraFrameTop + 50 }]}
      pointerEvents="none"
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        <RotatableView rotation={rotation}>
          <View style={styles.pill}>
            {result ? (
              <View style={styles.content}>
                {/* Aesthetic score (TANet) */}
                <View style={styles.scoreRow}>
                  <Text style={styles.icon}>👁</Text>
                  <Text style={[styles.score, { color: aestheticColor }]}>
                    {Math.round(aestheticScore)}
                  </Text>
                </View>

                {/* Composition score (SAMP-Net) */}
                {result.composition_score != null && (
                  <View style={styles.scoreRow}>
                    <Text style={styles.icon}>📐</Text>
                    <Text style={[styles.score, { color: compositionColor }]}>
                      {Math.round(result.composition_score)}
                    </Text>
                  </View>
                )}

                {/* Dominant pattern name */}
                {compositionTypeName && (
                  <Text style={styles.patternName}>
                    {compositionTypeName}
                  </Text>
                )}

                {/* Inference time */}
                <Text style={styles.timing}>
                  {result.inference_ms.toFixed(0)}ms
                </Text>
              </View>
            ) : (
              <Text style={styles.connecting}>Connecting...</Text>
            )}
          </View>
        </RotatableView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    zIndex: 30,
  },
  pill: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 10,
    minWidth: 80,
  },
  content: {
    alignItems: 'center',
    gap: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  score: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  patternName: {
    fontSize: 9,
    color: '#aaa',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  timing: {
    fontSize: 9,
    color: '#888',
    marginTop: 2,
  },
  connecting: {
    fontSize: 11,
    color: '#888',
  },
});

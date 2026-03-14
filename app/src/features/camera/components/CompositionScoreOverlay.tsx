import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { CompositionResult } from '../hooks/useCompositionScore';
import { RotatableView } from './RotatableView';

interface Props {
  result: CompositionResult | null;
  connected: boolean;
  rotation?: 0 | 90 | 180 | 270;
  cameraFrameTop: number;
}

const scoreToColor = (score: number): string => {
  // score is 0-1 raw from TANet
  const t = Math.max(0, Math.min(1, score));
  if (t < 0.25) return '#ff4444';
  if (t < 0.5) return '#ff9900';
  if (t < 0.75) return '#aacc00';
  return '#44cc44';
};

const DistributionBar: React.FC<{ distribution: number[] }> = ({ distribution }) => {
  const maxVal = Math.max(...distribution, 0.01);
  const barColors = ['#ff4444', '#ff9900', '#dddd00', '#aacc00', '#44cc44'];

  return (
    <View style={barStyles.container}>
      {distribution.map((val, i) => (
        <View key={i} style={barStyles.barWrapper}>
          <View
            style={[
              barStyles.bar,
              {
                height: Math.max(2, (val / maxVal) * 20),
                backgroundColor: barColors[i],
              },
            ]}
          />
          <Text style={barStyles.label}>{i + 1}</Text>
        </View>
      ))}
    </View>
  );
};

export const CompositionScoreOverlay: React.FC<Props> = ({
  result,
  connected,
  rotation = 0,
  cameraFrameTop,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasShown = useRef(false);

  useEffect(() => {
    // Only animate on first appearance, not on every score update
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

  const color = result ? scoreToColor(result.score) : '#888';

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
                {/* Score */}
                <View style={styles.scoreSection}>
                  <Text style={[styles.score, { color }]}>
                    {result.score.toFixed(3)}
                  </Text>
                </View>

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
  scoreSection: {
    alignItems: 'center',
  },
  score: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  aesthetic: {
    fontSize: 11,
    color: '#aaa',
    fontVariant: ['tabular-nums'],
  },
  tip: {
    fontSize: 10,
    color: '#ffcc00',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 100,
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

const barStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 28,
    marginTop: 2,
  },
  barWrapper: {
    alignItems: 'center',
    width: 10,
  },
  bar: {
    width: 8,
    borderRadius: 2,
  },
  label: {
    fontSize: 7,
    color: '#666',
    marginTop: 1,
  },
});

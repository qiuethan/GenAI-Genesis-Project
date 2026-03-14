import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurCoachState } from '../hooks';

interface Props {
  state: BlurCoachState;
  showDebug?: boolean;
}

/**
 * Blur Coach Overlay Component
 * 
 * Displays coaching hints when blur is detected, and optionally
 * shows debug metrics for development/tuning.
 */
export const BlurCoachOverlay = ({ state, showDebug = false }: Props) => {
  const { hintText, debugMetrics } = state;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Coaching Hint */}
      {hintText && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>{hintText}</Text>
        </View>
      )}

      {/* Debug Overlay */}
      {showDebug && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            S: {debugMetrics.sharpness.toFixed(0)} | EMA: {debugMetrics.sharpnessEMA.toFixed(0)}
          </Text>
          <Text style={styles.debugText}>
            Bad: {debugMetrics.thresholdBad.toFixed(0)} | Ok: {debugMetrics.thresholdOk.toFixed(0)}
          </Text>
          <Text style={styles.debugText}>
            Brightness: {debugMetrics.brightness.toFixed(0)} | Cal: {debugMetrics.isCalibrated ? '✓' : '...'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 100,
  },
  hintText: {
    color: '#ffe81f',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  debugContainer: {
    position: 'absolute',
    bottom: 120,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 4,
  },
  debugText: {
    color: '#00ff00',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

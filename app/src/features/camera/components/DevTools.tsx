import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ShakeCoachState } from '../hooks/useShakeCoach';
import { ExposureCoachState } from '../hooks/useExposureCoach';
import { LevelCoachState } from '../hooks/useLevelCoach';

interface DevToolsProps {
  enabled?: boolean;
  shakeCoach?: ShakeCoachState;
  exposureCoach?: ExposureCoachState;
  levelCoach?: LevelCoachState;
  additionalMetrics?: Record<string, string | number | boolean>;
}

/**
 * Centralized Dev Tools Overlay
 * 
 * Collapsible debug panel that shows various metrics during development.
 * Set enabled={false} in production.
 */
export const DevTools = ({ 
  enabled = __DEV__, 
  shakeCoach,
  exposureCoach,
  levelCoach,
  additionalMetrics,
}: DevToolsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!enabled) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity 
        style={styles.toggleButton}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Text style={styles.toggleText}>
          {isExpanded ? '▼ DevTools' : '▶ DevTools'}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
          {/* Shake Coach Metrics */}
          {shakeCoach && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shake Coach</Text>
              <MetricRow label="Magnitude" value={`${(shakeCoach.debugMetrics.magnitude * 100).toFixed(0)}%`} />
              <MetricRow label="Accel" value={`${(shakeCoach.debugMetrics.accelMagnitude * 100).toFixed(0)}%`} />
              <MetricRow label="Gyro" value={`${(shakeCoach.debugMetrics.gyroMagnitude * 100).toFixed(0)}%`} />
              <MetricRow label="Is Shaking" value={shakeCoach.isShaking ? 'YES' : 'no'} highlight={shakeCoach.isShaking} />
              <MetricRow label="Hint" value={shakeCoach.hintText || '(none)'} />
            </View>
          )}

          {/* Level Coach Metrics */}
          {levelCoach && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Level Coach</Text>
              <MetricRow label="Angle" value={`${levelCoach.angle.toFixed(1)}°`} />
              <MetricRow label="Is Level" value={levelCoach.isLevel ? 'YES' : 'no'} highlight={levelCoach.isLevel} />
              <MetricRow label="Is Active" value={levelCoach.isActive ? 'YES' : 'no'} />
              <MetricRow label="Hint" value={levelCoach.hintText || '(none)'} />
            </View>
          )}

          {/* Exposure Coach Metrics */}
          {exposureCoach && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exposure</Text>
              <MetricRow 
                label="High Clip" 
                value={`${((exposureCoach.metrics?.highlightClipPct || 0) * 100).toFixed(1)}%`} 
                highlight={(exposureCoach.metrics?.highlightClipPct || 0) > 0.01} 
              />
              <MetricRow 
                label="Low Clip" 
                value={`${((exposureCoach.metrics?.shadowClipPct || 0) * 100).toFixed(1)}%`} 
                highlight={(exposureCoach.metrics?.shadowClipPct || 0) > 0.05} 
              />
              <MetricRow label="Mean Lum" value={(exposureCoach.metrics?.meanLuminance || 0).toFixed(1)} />
              <MetricRow label="Hint" value={exposureCoach.hintText || '(none)'} highlight={!!exposureCoach.hintText} />
            </View>
          )}

          {/* Additional Metrics */}
          {additionalMetrics && Object.keys(additionalMetrics).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Other</Text>
              {Object.entries(additionalMetrics).map(([key, value]) => (
                <MetricRow key={key} label={key} value={String(value)} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const MetricRow = ({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: string; 
  value: string; 
  highlight?: boolean;
}) => (
  <View style={styles.metricRow}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, highlight && styles.metricHighlight]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 150,
    right: 10,
    zIndex: 1000,
  },
  toggleButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  toggleText: {
    color: '#00ff00',
    fontSize: 11,
    fontWeight: '600',
  },
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 6,
    marginTop: 4,
    maxHeight: 300,
    minWidth: 180,
  },
  panelContent: {
    padding: 10,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#00ff00',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#00ff0044',
    paddingBottom: 2,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metricLabel: {
    color: '#888',
    fontSize: 10,
  },
  metricValue: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  metricHighlight: {
    color: '#ff4444',
    fontWeight: '700',
  },
});

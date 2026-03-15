import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import type { ScanResult } from '../hooks/useScanMode';

interface Props {
  isScanMode: boolean;
  isScanning: boolean;
  isProcessing: boolean;
  hasResult: boolean;
  result: ScanResult | null;
  error: string | null;
  frameCount: number;
  scoredCount: number;
  countdown: number;
  onStartScan: () => void;
  onStopScan: () => void;
  onSaveBest: () => void;
  onGuideMode: () => void;
  onDone: () => void;
  cameraFrameTop: number;
  cameraFrameHeight: number;
}

export const ScanOverlay: React.FC<Props> = ({
  isScanMode, isScanning, isProcessing, hasResult,
  result, error, frameCount, scoredCount, countdown,
  onStartScan, onStopScan, onSaveBest, onGuideMode, onDone,
  cameraFrameTop, cameraFrameHeight,
}) => {
  if (!isScanMode) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="box-none">
      {/* Ready state */}
      {!isScanning && !isProcessing && !hasResult && !error && (
        <View style={[s.centerRow, { top: cameraFrameTop + cameraFrameHeight - 100 }]}>
          <TouchableOpacity style={s.scanBtn} onPress={onStartScan}>
            <Text style={s.scanText}>Start Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scanning — capturing frames based on tilt */}
      {isScanning && (
        <>
          <View style={[s.statusBar, { top: cameraFrameTop + 10 }]}>
            <View style={s.statusPill}>
              <Text style={s.statusText}>
                {countdown}s — Move phone slowly  |  {frameCount} frames
              </Text>
            </View>
          </View>

          <View style={[s.centerRow, { top: cameraFrameTop + cameraFrameHeight - 100 }]}>
            <TouchableOpacity style={s.stopBtn} onPress={onStopScan}>
              <Text style={s.stopText}>Done Scanning</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Processing — scoring frames */}
      {isProcessing && (
        <View style={[s.cardContainer, { top: cameraFrameTop + cameraFrameHeight / 2 - 70 }]}>
          <View style={s.card}>
            <ActivityIndicator size="large" color="#00ff88" style={{ marginBottom: 12 }} />
            <Text style={s.cardTitle}>Finding best composition...</Text>
            <Text style={s.cardBody}>
              {scoredCount} / {frameCount} frames scored
            </Text>
          </View>
        </View>
      )}

      {/* Result — two options */}
      {hasResult && result && (
        <View style={[s.cardContainer, { top: cameraFrameTop + cameraFrameHeight / 2 - 90 }]}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Best Score: {result.bestScore}</Text>
            <Text style={s.cardBody}>Choose what to do with this composition:</Text>

            <TouchableOpacity style={s.optionBtn} onPress={onSaveBest}>
              <Text style={s.optionTitle}>Save to Gallery</Text>
              <Text style={s.optionDesc}>Save the best frame with its score</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.optionBtn} onPress={onGuideMode}>
              <Text style={s.optionTitle}>Composition Guide</Text>
              <Text style={s.optionDesc}>Overlay the best frame to line up your shot</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.dismissBtn} onPress={onDone}>
              <Text style={s.dismissText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={[s.cardContainer, { top: cameraFrameTop + cameraFrameHeight / 2 - 50 }]}>
          <View style={s.card}>
            <Text style={[s.cardBody, { color: '#ff4444' }]}>{error}</Text>
            <TouchableOpacity style={s.dismissBtn} onPress={onDone}>
              <Text style={s.dismissText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  centerRow: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
  },
  statusBar: {
    position: 'absolute',
    left: 20, right: 20,
    alignItems: 'center',
  },
  statusPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  statusText: {
    color: '#00ff88',
    fontSize: 15,
    fontWeight: '700',
  },
  scanBtn: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 30,
  },
  scanText: { color: 'black', fontSize: 17, fontWeight: '700' },
  stopBtn: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 30,
  },
  stopText: { color: 'white', fontSize: 17, fontWeight: '700' },
  cardContainer: {
    position: 'absolute',
    left: 24, right: 24,
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    width: '100%',
  },
  cardTitle: {
    color: '#00ff88',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardBody: {
    color: '#ccc',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  optionBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    marginBottom: 10,
  },
  optionTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionDesc: {
    color: '#999',
    fontSize: 12,
  },
  dismissBtn: {
    paddingVertical: 10,
    marginTop: 4,
  },
  dismissText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
});

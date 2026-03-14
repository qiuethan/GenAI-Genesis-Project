import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import type { Detection } from '../../../infra/visionCamera';
import type { SelectedObject, ScanResult } from '../hooks/useScanMode';

interface Props {
  isSelecting: boolean;
  isScanning: boolean;
  hasResult: boolean;
  selectedObjects: SelectedObject[];
  detections: Detection[];
  progress: number;
  result: ScanResult | null;
  error: string | null;
  onStartScan: () => void;
  onCancel: () => void;
  cameraFrameTop: number;
  cameraFrameHeight: number;
  cameraFrameWidth: number;
}

export const ScanOverlay: React.FC<Props> = ({
  isSelecting, isScanning, hasResult,
  selectedObjects, detections,
  progress, result, error,
  onStartScan, onCancel,
  cameraFrameTop, cameraFrameHeight, cameraFrameWidth,
}) => {
  const hasSelected = selectedObjects.length > 0;
  if (!isSelecting && !isScanning && !hasResult && !hasSelected) return null;

  // Match each selected object to its live YOLO detection
  const trackedBoxes = selectedObjects.map(sel => {
    const match = detections.find(d =>
      d.label === sel.label &&
      Math.abs((d.x1 + d.x2) / 2 - (sel.box_norm[0] + sel.box_norm[2]) / 2) < 0.3
    );
    return {
      ...sel,
      liveBox: match ? [match.x1, match.y1, match.x2, match.y2] as const : sel.box_norm,
      isTracked: match != null,
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Only draw boxes for selected objects — tracked live via YOLO */}
      {trackedBoxes.map((obj) => {
        const [nx1, ny1, nx2, ny2] = obj.liveBox;
        const left = nx1 * cameraFrameWidth;
        const top = cameraFrameTop + ny1 * cameraFrameHeight;
        const width = (nx2 - nx1) * cameraFrameWidth;
        const height = (ny2 - ny1) * cameraFrameHeight;

        return (
          <View
            key={obj.id}
            style={[s.objectBox, {
              left, top, width, height,
              borderColor: obj.isTracked ? '#00ff88' : '#ff4444',
            }]}
            pointerEvents="none"
          >
            <View style={[s.labelBg, {
              backgroundColor: obj.isTracked ? '#00ff88' : '#ff4444',
            }]}>
              <Text style={s.labelText}>{obj.label}</Text>
            </View>
          </View>
        );
      })}

      {/* Selection mode hint */}
      {isSelecting && (
        <View style={[s.hintBar, { top: cameraFrameTop + 10 }]}>
          <Text style={s.hintText}>
            {selectedObjects.length === 0
              ? 'Tap objects to keep in frame'
              : `${selectedObjects.length} selected`}
          </Text>
        </View>
      )}

      {/* Start scan / cancel buttons */}
      {isSelecting && selectedObjects.length > 0 && (
        <View style={[s.buttonRow, { top: cameraFrameTop + cameraFrameHeight - 70 }]}>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.scanBtn} onPress={onStartScan}>
            <Text style={s.scanText}>Start Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scanning progress */}
      {isScanning && (
        <View style={[s.hintBar, { top: cameraFrameTop + 10 }]}>
          <Text style={s.hintText}>Pan slowly...</Text>
          <View style={s.progressBarBg}>
            <View style={[s.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Result: ghost overlay */}
      {hasResult && result && (
        <>
          <Image
            source={{ uri: result.bestFrameUri }}
            style={[s.ghostImage, { top: cameraFrameTop, height: cameraFrameHeight }]}
            resizeMode="cover"
          />
          <View style={[s.hintBar, { top: cameraFrameTop + 10 }]}>
            <Text style={s.hintText}>Best angle (score: {result.bestScore})</Text>
          </View>
          <View style={[s.buttonRow, { top: cameraFrameTop + cameraFrameHeight - 70 }]}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
              <Text style={s.cancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Error */}
      {error && (
        <View style={[s.hintBar, { top: cameraFrameTop + 50 }]}>
          <Text style={[s.hintText, { color: '#ff4444' }]}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  objectBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  labelBg: {
    position: 'absolute',
    top: -1,
    left: -1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomRightRadius: 4,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'black',
  },
  hintBar: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  hintText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  progressBarBg: {
    width: 200, height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2, marginTop: 8,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#00ff88',
    borderRadius: 2,
  },
  buttonRow: {
    position: 'absolute',
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16, zIndex: 50,
  },
  scanBtn: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 25,
  },
  scanText: { color: 'black', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 25,
  },
  cancelText: { color: 'white', fontSize: 16, fontWeight: '600' },
  ghostImage: {
    position: 'absolute',
    left: 0, right: 0,
    opacity: 0.4, zIndex: 40,
  },
});

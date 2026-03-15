import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, StyleSheet, LayoutChangeEvent } from 'react-native';

interface Props {
  compositionType: string | undefined;
  visible: boolean;
}

const LINE_COLOR = 'rgba(255, 255, 255, 0.25)';
const LINE_WIDTH = 1;

// Rule of thirds: equal 3x3 grid
const RuleOfThirdsOverlay = () => (
  <View style={[StyleSheet.absoluteFill, { flexDirection: 'column' }]} pointerEvents="none">
    {[0, 1, 2].map(r => (
      <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
        {[0, 1, 2].map(c => (
          <View key={c} style={{ flex: 1, borderWidth: 0.5, borderColor: LINE_COLOR }} />
        ))}
      </View>
    ))}
  </View>
);

// Golden ratio: grid at phi divisions (1:1.618)
const GoldenRatioOverlay = () => {
  const phi = 1 / 2.618; // ~0.382
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ position: 'absolute', top: `${phi * 100}%`, left: 0, right: 0, height: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
      <View style={{ position: 'absolute', top: `${(1 - phi) * 100}%`, left: 0, right: 0, height: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
      <View style={{ position: 'absolute', left: `${phi * 100}%`, top: 0, bottom: 0, width: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
      <View style={{ position: 'absolute', left: `${(1 - phi) * 100}%`, top: 0, bottom: 0, width: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
    </View>
  );
};

// Symmetry: vertical center line
const SymmetryOverlay = () => (
  <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]} pointerEvents="none">
    <View style={{ flex: 1 }} />
    <View style={{ width: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
    <View style={{ flex: 1 }} />
  </View>
);

// Center/surround frame (for negative_space and framing)
const CenterFrameOverlay = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <View style={{
      position: 'absolute',
      left: '25%', top: '25%',
      width: '50%', height: '50%',
      borderWidth: LINE_WIDTH,
      borderColor: LINE_COLOR,
      borderRadius: 4,
    }} />
  </View>
);

// Quadrants (for patterns)
const QuadrantsOverlay = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
    <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
  </View>
);

// Foreground interest: horizontal line at lower third
const ForegroundInterestOverlay = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <View style={{ position: 'absolute', top: '66.7%', left: 0, right: 0, height: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
  </View>
);

// Layering: two horizontal lines dividing into 3 zones
const LayeringOverlay = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <View style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, height: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
    <View style={{ position: 'absolute', top: '66.7%', left: 0, right: 0, height: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
  </View>
);

// Diagonal lines
const DiagonalLine: React.FC<{
  w: number; h: number; direction: 'tl-br' | 'tr-bl';
}> = ({ w, h, direction }) => {
  if (w === 0 || h === 0) return null;
  const length = Math.sqrt(w ** 2 + h ** 2);
  const angle = Math.atan2(h, w) * (180 / Math.PI);
  const rotation = direction === 'tl-br' ? angle : -angle;
  return (
    <View style={{
      position: 'absolute', top: h / 2, left: w / 2,
      width: length, height: LINE_WIDTH, backgroundColor: LINE_COLOR,
      transform: [{ translateX: -length / 2 }, { rotate: `${rotation}deg` }],
    }} />
  );
};

const DiagonalOverlay: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <DiagonalLine w={width} h={height} direction="tl-br" />
    <DiagonalLine w={width} h={height} direction="tr-bl" />
  </View>
);

// Triangle: lines from bottom corners to top center
const TriangleOverlay: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  if (width === 0 || height === 0) return null;
  const lineLen = Math.sqrt((width / 2) ** 2 + height ** 2);
  const leftAngle = -Math.atan2(height, width / 2) * (180 / Math.PI);
  const rightAngle = Math.atan2(height, width / 2) * (180 / Math.PI);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{
        position: 'absolute', bottom: 0, left: 0,
        width: lineLen, height: LINE_WIDTH, backgroundColor: LINE_COLOR,
        transformOrigin: 'left center',
        transform: [{ rotate: `${leftAngle}deg` }],
      }} />
      <View style={{
        position: 'absolute', bottom: 0, right: 0,
        width: lineLen, height: LINE_WIDTH, backgroundColor: LINE_COLOR,
        transformOrigin: 'right center',
        transform: [{ rotate: `${rightAngle}deg` }],
      }} />
    </View>
  );
};

// Map classifier output to overlay components (only types with visual overlays)
const OVERLAY_MAP: Record<string, string> = {
  rule_of_thirds: 'rule_of_thirds',
  golden_ratio: 'golden_ratio',
  symmetric: 'symmetry',
  diagonal: 'diagonals',
  triangle: 'triangles',
};

export const CompositionPatternOverlay: React.FC<Props> = ({ compositionType, visible }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, compositionType]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDimensions({ width, height });
  };

  const overlayKey = compositionType ? OVERLAY_MAP[compositionType] : undefined;

  const renderOverlay = () => {
    switch (overlayKey) {
      case 'rule_of_thirds': return <RuleOfThirdsOverlay />;
      case 'golden_ratio': return <GoldenRatioOverlay />;
      case 'symmetry': return <SymmetryOverlay />;
      case 'diagonals': return <DiagonalOverlay width={dimensions.width} height={dimensions.height} />;
      case 'triangles': return <TriangleOverlay width={dimensions.width} height={dimensions.height} />;
      case 'center_frame': return <CenterFrameOverlay />;
      case 'foreground': return <ForegroundInterestOverlay />;
      case 'layering': return <LayeringOverlay />;
      case 'quadrants': return <QuadrantsOverlay />;
      default: return null;
    }
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {renderOverlay()}
    </Animated.View>
  );
};

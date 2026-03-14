import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, StyleSheet, LayoutChangeEvent } from 'react-native';

interface Props {
  dominantPattern: number | undefined; // 0-7
  visible: boolean;
}

const LINE_COLOR = 'rgba(255, 255, 255, 0.25)';
const LINE_WIDTH = 1;

const HorizontalPattern = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <View style={{ flex: 1 }} />
    <View style={{ height: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
    <View style={{ flex: 1 }} />
  </View>
);

const VerticalPattern = () => (
  <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]} pointerEvents="none">
    <View style={{ flex: 1 }} />
    <View style={{ width: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
    <View style={{ flex: 1 }} />
  </View>
);

const CenterSurroundPattern = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <View style={{
      position: 'absolute',
      left: '25%',
      top: '25%',
      width: '50%',
      height: '50%',
      borderWidth: LINE_WIDTH,
      borderColor: LINE_COLOR,
      borderRadius: 4,
    }} />
  </View>
);

const QuadrantsPattern = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* Horizontal line */}
    <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
    {/* Vertical line */}
    <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: LINE_WIDTH, backgroundColor: LINE_COLOR }} />
  </View>
);

const RuleOfThirdsPattern = () => (
  <View style={[StyleSheet.absoluteFill, { flexDirection: 'column' }]} pointerEvents="none">
    <View style={thirdStyles.row}>
      <View style={thirdStyles.cell} />
      <View style={thirdStyles.cell} />
      <View style={thirdStyles.cell} />
    </View>
    <View style={thirdStyles.row}>
      <View style={thirdStyles.cell} />
      <View style={thirdStyles.cell} />
      <View style={thirdStyles.cell} />
    </View>
    <View style={thirdStyles.row}>
      <View style={thirdStyles.cell} />
      <View style={thirdStyles.cell} />
      <View style={thirdStyles.cell} />
    </View>
  </View>
);

const thirdStyles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1, borderWidth: 0.5, borderColor: LINE_COLOR },
});

/** Diagonal lines need actual dimensions to compute length and angle. */
const DiagonalLine: React.FC<{
  containerWidth: number;
  containerHeight: number;
  direction: 'tl-br' | 'tr-bl';
}> = ({ containerWidth, containerHeight, direction }) => {
  if (containerWidth === 0 || containerHeight === 0) return null;
  const length = Math.sqrt(containerWidth ** 2 + containerHeight ** 2);
  const angle = Math.atan2(containerHeight, containerWidth) * (180 / Math.PI);
  const rotation = direction === 'tl-br' ? angle : -angle;

  return (
    <View style={{
      position: 'absolute',
      top: containerHeight / 2,
      left: containerWidth / 2,
      width: length,
      height: LINE_WIDTH,
      backgroundColor: LINE_COLOR,
      transform: [
        { translateX: -length / 2 },
        { rotate: `${rotation}deg` },
      ],
    }} />
  );
};

const DiagonalCrossPattern: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <DiagonalLine containerWidth={width} containerHeight={height} direction="tl-br" />
    <DiagonalLine containerWidth={width} containerHeight={height} direction="tr-bl" />
  </View>
);

const UpperTrianglePattern: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  if (width === 0 || height === 0) return null;
  // Two lines from bottom corners meeting at top center
  const leftLen = Math.sqrt((width / 2) ** 2 + height ** 2);
  const leftAngle = -Math.atan2(height, width / 2) * (180 / Math.PI);
  const rightAngle = Math.atan2(height, width / 2) * (180 / Math.PI);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Bottom-left to top-center */}
      <View style={{
        position: 'absolute',
        bottom: 0, left: 0,
        width: leftLen,
        height: LINE_WIDTH,
        backgroundColor: LINE_COLOR,
        transformOrigin: 'left center',
        transform: [{ rotate: `${leftAngle}deg` }],
      }} />
      {/* Bottom-right to top-center */}
      <View style={{
        position: 'absolute',
        bottom: 0, right: 0,
        width: leftLen,
        height: LINE_WIDTH,
        backgroundColor: LINE_COLOR,
        transformOrigin: 'right center',
        transform: [{ rotate: `${rightAngle}deg` }],
      }} />
    </View>
  );
};

const LowerTrianglePattern: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  if (width === 0 || height === 0) return null;
  const lineLen = Math.sqrt((width / 2) ** 2 + height ** 2);
  const leftAngle = Math.atan2(height, width / 2) * (180 / Math.PI);
  const rightAngle = -Math.atan2(height, width / 2) * (180 / Math.PI);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top-left to bottom-center */}
      <View style={{
        position: 'absolute',
        top: 0, left: 0,
        width: lineLen,
        height: LINE_WIDTH,
        backgroundColor: LINE_COLOR,
        transformOrigin: 'left center',
        transform: [{ rotate: `${leftAngle}deg` }],
      }} />
      {/* Top-right to bottom-center */}
      <View style={{
        position: 'absolute',
        top: 0, right: 0,
        width: lineLen,
        height: LINE_WIDTH,
        backgroundColor: LINE_COLOR,
        transformOrigin: 'right center',
        transform: [{ rotate: `${rightAngle}deg` }],
      }} />
    </View>
  );
};

export const CompositionPatternOverlay: React.FC<Props> = ({ dominantPattern, visible }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, dominantPattern]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDimensions({ width, height });
  };

  const renderPattern = () => {
    switch (dominantPattern) {
      case 0: return <HorizontalPattern />;
      case 1: return <VerticalPattern />;
      case 2: return <UpperTrianglePattern width={dimensions.width} height={dimensions.height} />;
      case 3: return <LowerTrianglePattern width={dimensions.width} height={dimensions.height} />;
      case 4: return <CenterSurroundPattern />;
      case 5: return <QuadrantsPattern />;
      case 6: return <DiagonalCrossPattern width={dimensions.width} height={dimensions.height} />;
      case 7: return <RuleOfThirdsPattern />;
      default: return null;
    }
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {renderPattern()}
    </Animated.View>
  );
};

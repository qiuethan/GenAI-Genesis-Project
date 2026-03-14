import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface Props {
  rotation: 0 | 90 | 180 | 270;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const RotatableView = ({ rotation, children, style }: Props) => {
  // continuousRotation tracks the cumulative degrees (can be negative or > 360)
  const continuousRotation = useRef(rotation);
  const rotationAnim = useRef(new Animated.Value(rotation)).current;

  useEffect(() => {
    // Calculate current effective rotation (0-360)
    let currentEffective = continuousRotation.current % 360;
    if (currentEffective < 0) currentEffective += 360;
    
    // Calculate difference to target
    let diff = rotation - currentEffective;
    
    // Optimize for shortest path
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    
    // Update continuous value
    continuousRotation.current += diff;
    
    Animated.spring(rotationAnim, {
      toValue: continuousRotation.current,
      useNativeDriver: true,
      friction: 7,
      tension: 40,
    }).start();
  }, [rotation]);

  const rotate = rotationAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[style, { transform: [{ rotate }] }]}>
      {children}
    </Animated.View>
  );
};
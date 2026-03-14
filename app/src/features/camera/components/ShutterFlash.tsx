import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Animated, View, Dimensions } from 'react-native';

export interface ShutterFlashHandle {
  trigger: () => void;
}

export const ShutterFlash = forwardRef<ShutterFlashHandle, {}>((_, ref) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    trigger: () => {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    },
  }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: 'black',
          opacity,
          zIndex: 999, // Ensure it's on top
        },
      ]}
      pointerEvents="none"
    />
  );
});

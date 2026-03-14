import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { overlayStyles } from './styles';
import { RotatableView } from '../RotatableView';

/**
 * CoachingHint Component
 * 
 * A reusable hint pill that positions itself correctly within the camera frame
 * based on device orientation.
 * 
 * - Portrait: Above zoom controls
 * - Landscape: Centered vertically on left/right edge
 * - Handles text rotation
 * - Includes fade in/out animation
 */

export interface CoachingHintProps {
  /** Text to display in the hint */
  text: string;
  /** Whether the hint should be visible */
  visible: boolean;
  /** UI Rotation (0, 90, 180, 270) */
  rotation: 0 | 90 | 180 | 270;
  /** Top position of the camera frame (to avoid black bars/safe areas) */
  cameraFrameTop: number;
  /** Height of the camera frame */
  cameraFrameHeight: number;
  /** Fade duration in ms */
  fadeDuration?: number;
  /** Stack order (0 = bottom/default, 1 = above 0, etc.) */
  stackOrder?: number;
}

export const CoachingHint: React.FC<CoachingHintProps> = ({
  text,
  visible,
  rotation,
  cameraFrameTop,
  cameraFrameHeight,
  fadeDuration = 200,
  stackOrder = 0,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: fadeDuration,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim, fadeDuration]);

  // Don't render if not visible and fully faded out
  // We can't easily check animated value synchronously for render return, 
  // but if visible is false and we want to unmount after animation...
  // For now, we'll just render with 0 opacity to keep it simple, or return null if !visible meant "unmount".
  // But usually fade out implies we keep it mounted until faded. 
  // However, for layout calculations, if it's 0 opacity it's fine.
  
  // Logic ported from ShakeCoachOverlay
  const FRAME_EDGE_SPACING = 25;
  const STACK_SPACING = 40; // Spacing between stacked hints
  const verticalOffset = stackOrder * STACK_SPACING;

  let containerStyle: any = {
    position: 'absolute',
  };

  if (rotation === 0 || rotation === 180) {
    // Portrait: Position just above zoom buttons
    // Zoom buttons are at: cameraFrameTop + cameraFrameHeight - 50
    // Position hint ~40px above zoom buttons => -90
    // Apply stack offset (moving up)
    containerStyle.top = cameraFrameTop + cameraFrameHeight - 90 - verticalOffset;
    containerStyle.left = 0;
    containerStyle.right = 0;
    containerStyle.alignItems = 'center';
  } else {
    // Landscape (90 or 270)
    // Use a fixed-size container centered on the target point
    const CONTAINER_SIZE = 200;
    const HALF_SIZE = CONTAINER_SIZE / 2;
    
    containerStyle.width = CONTAINER_SIZE;
    containerStyle.height = CONTAINER_SIZE;
    containerStyle.alignItems = 'center';
    containerStyle.justifyContent = 'center';
    // Center vertically, then shift up by stack offset
    containerStyle.top = cameraFrameTop + cameraFrameHeight / 2 - HALF_SIZE - verticalOffset;
    containerStyle.zIndex = 9999;
    containerStyle.pointerEvents = 'none'; // Ensure clicks pass through
    
    if (rotation === 90) {
      // Landscape right: position against right edge
      containerStyle.right = FRAME_EDGE_SPACING - HALF_SIZE;
    } else if (rotation === 270) {
      // Landscape left: position against left edge
      containerStyle.left = FRAME_EDGE_SPACING - HALF_SIZE;
    }
  }

  return (
    <View style={containerStyle} pointerEvents="none">
      <Animated.View style={{ opacity: fadeAnim }}>
        <RotatableView rotation={rotation}>
          <View style={overlayStyles.hintPill}>
            <Text style={overlayStyles.hintText}>{text}</Text>
          </View>
        </RotatableView>
      </Animated.View>
    </View>
  );
};
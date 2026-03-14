import React from 'react';
import { ShakeCoachState } from '../hooks/useShakeCoach';
import { CoachingHint } from './overlays/CoachingHint';

interface ShakeCoachOverlayProps {
  state: ShakeCoachState;
  rotation?: 0 | 90 | 180 | 270;
  cameraFrameTop: number;
  cameraFrameHeight: number;
  stackOrder?: number;
}

/**
 * Overlay component that displays shake/motion coaching hints.
 * Uses the shared CoachingHint component for consistent positioning and styling.
 */
export const ShakeCoachOverlay: React.FC<ShakeCoachOverlayProps> = ({
  state,
  rotation = 0,
  cameraFrameTop,
  cameraFrameHeight,
  stackOrder = 0,
}) => {
  const { hintText } = state;

  return (
    <CoachingHint
      text={hintText || "Hold still."} // Default text if fading out
      visible={!!hintText}
      rotation={rotation}
      cameraFrameTop={cameraFrameTop}
      cameraFrameHeight={cameraFrameHeight}
      stackOrder={stackOrder}
    />
  );
};

import React from 'react';
import { ExposureCoachState } from '../hooks/useExposureCoach';
import { CoachingHint } from './overlays/CoachingHint';

interface ExposureCoachOverlayProps {
  state: ExposureCoachState;
  rotation?: 0 | 90 | 180 | 270;
  cameraFrameTop: number;
  cameraFrameHeight: number;
}

/**
 * Overlay component that displays exposure warnings.
 * Uses the shared CoachingHint component.
 */
export const ExposureCoachOverlay: React.FC<ExposureCoachOverlayProps> = ({
  state,
  rotation = 0,
  cameraFrameTop,
  cameraFrameHeight,
}) => {
  const { hintText } = state;

  return (
    <CoachingHint
      text={hintText || ""}
      visible={!!hintText}
      rotation={rotation}
      cameraFrameTop={cameraFrameTop}
      cameraFrameHeight={cameraFrameHeight}
    />
  );
};

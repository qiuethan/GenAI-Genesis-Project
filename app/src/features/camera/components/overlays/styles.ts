import { StyleSheet } from 'react-native';

/**
 * Shared overlay styling constants
 * Single source of truth for overlay appearance
 */

export const OVERLAY_COLORS = {
  background: 'rgba(0, 0, 0, 0.6)',
  text: '#fff',
  warning: '#ffcc00',
  debug: {
    background: 'rgba(0, 0, 0, 0.7)',
    text: '#aaa',
    title: '#fff',
  },
} as const;

export const overlayStyles = StyleSheet.create({
  // Container that fills the camera frame
  fullContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  
  // Top-positioned container
  topContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 12,
  },
  
  // Bottom-positioned container
  bottomContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
  },
  
  // Standard hint pill
  hintPill: {
    backgroundColor: OVERLAY_COLORS.background,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  
  // Hint text
  hintText: {
    color: OVERLAY_COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  
  // Debug panel
  debugPanel: {
    position: 'absolute',
    top: 60,
    right: 10,
    backgroundColor: OVERLAY_COLORS.debug.background,
    padding: 8,
    borderRadius: 8,
    minWidth: 100,
  },
  
  debugTitle: {
    color: OVERLAY_COLORS.debug.title,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  
  debugText: {
    color: OVERLAY_COLORS.debug.text,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  
  debugWarning: {
    color: OVERLAY_COLORS.warning,
  },
});

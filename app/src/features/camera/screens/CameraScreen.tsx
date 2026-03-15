import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions, Animated, StyleSheet, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { cameraStyles as styles } from '../styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinchGestureHandler, PinchGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';

import {
  CameraView,
  CameraHandle,
  useSelfCameraDevice,
  useSelfCameraPermission,
  CameraPosition,
  takePhoto,
  FlashMode,
  useZoom,
  formatZoomDisplay,
  useAnalysisFrameProcessor,
} from '../../../infra/visionCamera';
import { saveToLibrary } from '../../../infra/mediaLibrary/saveToLibrary';
import { getLatestPhoto } from '../../../infra/mediaLibrary/getLatestPhoto';
import { useDeviceOrientation } from '../../../infra/sensors/useDeviceOrientation';

import { CaptureButton } from '../components/CaptureButton';
import { CompositionPatternOverlay } from '../components/CompositionPatternOverlay';
import { IconButton } from '../components/IconButton';
import { RotatableView } from '../components/RotatableView';
import { ShutterFlash, ShutterFlashHandle } from '../components/ShutterFlash';
import { CameraControlsMenu } from '../components/CameraControlsMenu';
import { useTimer, useNightMode, useExposure, useFocus, useShakeCoach, useLevelCoach, useExposureCoach, useCompositionScore, useScanMode, scorePhoto } from '../hooks';
import { ShakeCoachOverlay } from '../components/ShakeCoachOverlay';
import { LevelCoachOverlay } from '../components/LevelCoachOverlay';
import { ExposureCoachOverlay } from '../components/ExposureCoachOverlay';
import { ScanOverlay } from '../components/ScanOverlay';

const scoreToColor = (score: number): string => {
  const t = Math.max(0, Math.min(1, score / 100));
  if (t < 0.25) return '#ff4444';
  if (t < 0.5) return '#ff9900';
  if (t < 0.75) return '#aacc00';
  return '#44cc44';
};

export const CameraScreen = () => {
  // State
  const [position, setPosition] = useState<CameraPosition>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const aspectRatio = '4:3' as const;
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sceneBrightness, setSceneBrightness] = useState<number>(0.5);

  // Camera control hooks
  const timer = useTimer();
  const nightMode = useNightMode();
  const exposureControl = useExposure();
  const focus = useFocus();
  const shakeCoach = useShakeCoach();
  const levelCoach = useLevelCoach();
  const exposureCoach = useExposureCoach();

  // Hooks
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const device = useSelfCameraDevice(position);
  const { zoom, zoomShared, config: zoomConfig, setZoom, onPinchBegan, onPinchUpdate, onPinchEnd, isPinching } = useZoom(device);

  const analysisFrameProcessor = useAnalysisFrameProcessor({
    onExposureMetrics: exposureCoach.onMetrics,
    enabled: isFocused,
  });

  // Calculate camera height based on aspect ratio (4:3 only)
  const camHeight = screenWidth * 4 / 3;

  // Calculate top margin to center camera with bottom bias
  const verticalBias = 100;
  const centeredTopMargin = Math.max(0, (screenHeight - camHeight - verticalBias) / 2);
  const topMargin = centeredTopMargin;

  // Animated values for smooth transitions
  const animatedHeight = useRef(new Animated.Value(camHeight)).current;
  const animatedTopMargin = useRef(new Animated.Value(topMargin)).current;
  const zoomIndicatorOpacity = useRef(new Animated.Value(0)).current;

  const { hasPermission, requestPermission } = useSelfCameraPermission();
  const cameraRef = useRef<CameraHandle>(null);
  const shutterRef = useRef<ShutterFlashHandle>(null);
  const insets = useSafeAreaInsets();
  const orientation = useDeviceOrientation();

  // Scan mode
  const scan = useScanMode(cameraRef);
  const frameProcessor = analysisFrameProcessor;

  // Composition assessment via Mac server over USB
  const composition = useCompositionScore({
    cameraRef,
    aspectRatio,
    enabled: isFocused,
  });

  // Mapping device orientation to UI rotation
  const uiRotation = orientation === 0 ? 0 : orientation === 180 ? 180 : orientation === 90 ? 90 : 270;

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  useEffect(() => {
    const loadLatestPhoto = async () => {
      const photoUri = await getLatestPhoto();
      if (photoUri) {
        setLastPhoto(photoUri);
      }
    };
    loadLatestPhoto();
  }, []);

  useEffect(() => {
    return () => {
      if (flash === 'torch') {
        setFlash('off');
      }
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animatedHeight, {
        toValue: camHeight,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }),
      Animated.spring(animatedTopMargin, {
        toValue: topMargin,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }),
    ]).start();
  }, [camHeight, topMargin]);

  useEffect(() => {
    Animated.timing(zoomIndicatorOpacity, {
      toValue: isPinching ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isPinching]);

  // Handlers
  const doCapture = async () => {
    try {
      // If flash is on, auto (when dark), or torch, keep it on for 1.5 seconds first
      const shouldPreFlash = flash === 'on' ||
                            flash === 'torch' ||
                            (flash === 'auto' && sceneBrightness < 0.3);

      if (shouldPreFlash) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Trigger shutter animation and take photo simultaneously
      shutterRef.current?.trigger();
      const path = await takePhoto(cameraRef, flash, sceneBrightness);
      if (!path) return;

      // Get image dimensions
      const { width, height } = await new Promise<{ width: number, height: number }>((resolve, reject) => {
        Image.getSize(`file://${path}`, (w, h) => resolve({ width: w, height: h }), reject);
      });

      const targetRatio = 4 / 3;

      // Handle portrait vs landscape
      const isPortrait = height > width;
      const currentRatio = height / width;
      const desiredRatio = isPortrait ? targetRatio : 1 / targetRatio;

      let cropConfig: ImageManipulator.ActionCrop['crop'] | null = null;

      // Calculate Crop
      if (Math.abs(currentRatio - desiredRatio) > 0.01) {
        let cropWidth = width;
        let cropHeight = height;

        if (currentRatio > desiredRatio) {
          cropHeight = width * desiredRatio;
        } else {
          cropWidth = height / desiredRatio;
        }

        cropConfig = {
          originX: (width - cropWidth) / 2,
          originY: (height - cropHeight) / 2,
          width: cropWidth,
          height: cropHeight,
        };
      }

      let finalPath = `file://${path}`;

      // Add crop if needed
      if (cropConfig) {
        const cropResult = await ImageManipulator.manipulateAsync(
          finalPath,
          [{ crop: cropConfig }],
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalPath = cropResult.uri;
      }

      const asset = await saveToLibrary(finalPath);

      // Score every captured photo
      scorePhoto(asset.id, asset.uri).catch(() => {});

      // Get displayable URI (ph:// can't be loaded by <Image>)
      const displayUri = await getLatestPhoto();
      if (displayUri) setLastPhoto(displayUri);

    } catch (e) {
      console.error("Processing failed", e);
    }
  };

  const handleCapture = () => {
    if (timer.isCountingDown) {
      timer.cancelCountdown();
      return;
    }
    timer.startCountdown(doCapture);
  };

  const toggleCamera = () => {
    setPosition(p => (p === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(f => {
      if (f === 'off') return 'auto';
      if (f === 'auto') return 'on';
      if (f === 'on') return 'torch';
      return 'off';
    });
  };

  const getFlashIcon = () => {
    switch (flash) {
      case 'on': return 'flash';
      case 'auto': return 'flash-outline';
      case 'torch': return 'flashlight';
      default: return 'flash-off';
    }
  };

  const getFlashColor = () => {
    return flash === 'torch' ? '#ffe81f' : (flash === 'on' ? '#ffe81f' : 'white');
  };

  const onPinchStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.BEGAN) {
      onPinchBegan();
    } else if (nativeEvent.state === State.END || nativeEvent.state === State.CANCELLED) {
      onPinchEnd();
    }
  };

  const onPinchEvent = ({ nativeEvent }: PinchGestureHandlerGestureEvent) => {
    onPinchUpdate(nativeEvent.scale);
  };

  if (!hasPermission) return <View style={styles.center}><Text style={styles.text}>No Permission</Text></View>;

  const aestheticColor = composition.result ? scoreToColor(composition.result.aesthetic_score) : '#666';
  const compositionColor = composition.result?.composition_score != null ? scoreToColor(composition.result.composition_score) : '#666';

  return (
    <View style={styles.container}>
      <ShutterFlash ref={shutterRef} />

      {/* Camera Layer with Pinch */}
      <PinchGestureHandler
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={(event) => {
            const { locationX, locationY } = event.nativeEvent;
            focus.focus({ x: locationX, y: locationY }, cameraRef);
          }}
        >
          {device ? (
            <CameraView
              ref={cameraRef}
              device={device}
              isActive={isFocused}
              zoom={zoomShared}
              torch={flash === 'torch' ? 'on' : 'off'}
              exposure={exposureControl.exposure / 2}
              lowLightBoost={nightMode.nightMode !== 'off'}
              frameProcessor={frameProcessor}
            />
          ) : (
            <View style={styles.center}>
               <Text style={styles.text}>No Device ({position})</Text>
            </View>
          )}

          {/* Focus Indicator */}
          {focus.focusPoint && (
            <Animated.View
              style={{
                position: 'absolute',
                left: focus.focusPoint.x - 40,
                top: focus.focusPoint.y - 40,
                width: 80,
                height: 80,
                borderWidth: 2,
                borderColor: focus.isFocusing ? '#ffe81f' : 'white',
                borderRadius: 4,
                opacity: focus.isFocusing ? 1 : 0.5,
              }}
              pointerEvents="none"
            />
          )}

          {/* Mask Overlay with Grid */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Top Mask */}
            <Animated.View style={{ height: animatedTopMargin, backgroundColor: 'rgba(0,0,0,0.3)' }} />

            {/* Clear Middle with Grid */}
            <Animated.View style={{ height: animatedHeight, width: screenWidth, alignSelf: 'center' }}>
              <CompositionPatternOverlay
                dominantPattern={composition.result?.dominant_pattern}
                visible={composition.result?.dominant_pattern !== undefined}
              />
            </Animated.View>

            {/* Bottom Mask */}
            <View style={{ flex: 1 }} />
          </View>

          {/* Timer Countdown Overlay */}
          {timer.isCountingDown && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'white', fontSize: 120, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 10 }}>
                  {timer.countdown}
                </Text>
              </View>
            </View>
          )}

          {/* Coaching Overlays */}
          {/* Visual Level Line (Center) - Always mounted, handles own opacity */}
          <LevelCoachOverlay
            state={levelCoach}
            cameraFrameTop={topMargin}
            cameraFrameHeight={camHeight}
            rotation={uiRotation}
          />

          {/* Text Hint (Bottom) - Priority: Exposure > Shake */}
          {exposureCoach.state.hintText ? (
            <ExposureCoachOverlay
              state={exposureCoach.state}
              rotation={uiRotation}
              cameraFrameTop={topMargin}
              cameraFrameHeight={camHeight}
            />
          ) : shakeCoach.state.hintText ? (
            <ShakeCoachOverlay
              state={shakeCoach.state}
              rotation={uiRotation}
              cameraFrameTop={topMargin}
              cameraFrameHeight={camHeight}
            />
          ) : null}

          {/* Composition Guide Overlay */}
          {scan.guideUri && scan.guideVisible && (
            <View
              style={{
                position: 'absolute',
                top: topMargin,
                left: 0,
                right: 0,
                height: camHeight,
              }}
              pointerEvents="none"
            >
              <Image
                source={{ uri: scan.guideUri }}
                style={{ width: '100%', height: '100%', opacity: 0.35 }}
                resizeMode="cover"
              />
            </View>
          )}

        </Pressable>
      </PinchGestureHandler>

      {/* Guide Mode Controls */}
      {scan.guideUri && (
        <View style={{ position: 'absolute', top: topMargin + 10, right: 12, zIndex: 60, flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={{ backgroundColor: scan.guideVisible ? '#00ff88' : 'rgba(255,255,255,0.3)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
            onPress={scan.toggleGuide}
          >
            <Text style={{ color: scan.guideVisible ? 'black' : 'white', fontSize: 12, fontWeight: '700' }}>
              {scan.guideVisible ? 'Guide ON' : 'Guide OFF'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
            onPress={scan.dismissGuide}
          >
            <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scan Mode Overlay */}
      <ScanOverlay
        isScanMode={scan.isScanMode}
        isScanning={scan.isScanning}
        isProcessing={scan.isProcessing}
        hasResult={scan.hasResult}
        result={scan.result}
        error={scan.error}
        frameCount={scan.frameCount}
        scoredCount={scan.scoredCount}
        countdown={scan.countdown}
        onStartScan={scan.startScan}
        onStopScan={scan.stopScan}
        onSaveBest={scan.saveBest}
        onGuideMode={scan.enterGuideMode}
        onDone={scan.exitScanMode}
        cameraFrameTop={topMargin}
        cameraFrameHeight={camHeight}
      />

      {/* Top Bar: Flash (Left) + Scores (Center) + Chevron (Right) */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        {/* Flash shortcut (only if menu closed) */}
        {!isMenuOpen && device?.hasFlash && (
          <View style={[styles.topLeftFlash, { top: insets.top }]}>
            <RotatableView rotation={uiRotation} style={styles.flashContainerColumn}>
              <View style={styles.iconButtonBg}>
                <IconButton
                  iconName={getFlashIcon()}
                  color={getFlashColor()}
                  onPress={toggleFlash}
                  size={18}
                />
              </View>
              {flash === 'auto' && <Text style={styles.indicatorText}>AUTO</Text>}
              {flash === 'torch' && <Text style={styles.indicatorText}>TORCH</Text>}
            </RotatableView>
          </View>
        )}

        {/* Scores (Center) */}
        {!isMenuOpen && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6 }}>
            {/* Aesthetic Score */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Ionicons name="flower-outline" size={15} color={aestheticColor} />
              <Text style={{ color: aestheticColor, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {composition.result ? Math.round(composition.result.aesthetic_score) : '--'}
              </Text>
            </View>

            {/* Composition Score */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
              <MaterialCommunityIcons name="image-filter-hdr" size={15} color={compositionColor} />
              <Text style={{ color: compositionColor, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {composition.result?.composition_score != null ? Math.round(composition.result.composition_score) : '--'}
              </Text>
            </View>
          </View>
        )}

        {/* Menu Toggle + Active Settings (Right) */}
        <View style={[styles.topRightRatio, { top: insets.top }]}>
          <View style={{ alignItems: 'center' }}>
            {/* Active settings above chevron */}
            {!isMenuOpen && (exposureControl.exposure !== 0 || nightMode.nightMode !== 'off' || timer.timerDuration > 0) && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                {timer.timerDuration > 0 && (
                  <Text style={{ color: '#ffe81f', fontSize: 11, fontWeight: '600' }}>{timer.timerDuration}s</Text>
                )}
                {nightMode.nightMode !== 'off' && (
                  <Ionicons name="moon" size={11} color="#ffe81f" />
                )}
                {exposureControl.exposure !== 0 && (
                  <Text style={{ color: '#ffe81f', fontSize: 11, fontWeight: '600' }}>
                    {exposureControl.exposure > 0 ? '+' : ''}{exposureControl.exposure}
                  </Text>
                )}
              </View>
            )}

            {/* Menu Toggle Chevron */}
            <RotatableView rotation={isMenuOpen ? 180 : 0} style={styles.chevronContainer}>
               <View style={styles.iconButtonBg}>
                 <IconButton
                   iconName="caret-up"
                   size={18}
                   onPress={() => setIsMenuOpen(!isMenuOpen)}
                 />
               </View>
            </RotatableView>
          </View>
        </View>
      </View>

      {/* Controls Menu (Top, under bar) */}
      {isMenuOpen && (
         <View style={[styles.menuContainer, { top: insets.top + 50 }]}>
           <CameraControlsMenu
              isOpen={isMenuOpen}
              flashMode={flash}
              onFlashPress={toggleFlash}
              timerDuration={timer.timerDuration}
              onTimerPress={timer.cycleTimer}
              nightMode={nightMode.nightMode}
              onNightModePress={nightMode.cycleNightMode}
              exposure={exposureControl.exposure}
              onExposurePress={exposureControl.cycleExposure}
           />
         </View>
      )}

      {/* Zoom Controls (Aligned to bottom of camera frame) */}
      {position === 'back' && zoomConfig.stops.length > 1 && (() => {
        const SNAP_THRESHOLD = 0.08;

        const closestStop = zoomConfig.stops.reduce((closest, stop) => {
          const currentDist = Math.abs(stop.zoom - zoom) / stop.zoom;
          const closestDist = Math.abs(closest.zoom - zoom) / closest.zoom;
          return currentDist < closestDist ? stop : closest;
        });

        const isSnappedToPreset = Math.abs(closestStop.zoom - zoom) / closestStop.zoom <= SNAP_THRESHOLD;

        const displayItems = zoomConfig.stops.map((stop, index) => {
          if (isSnappedToPreset && stop.zoom === closestStop.zoom) {
            return stop;
          }

          const nextStopIndex = zoomConfig.stops.findIndex(s => s.zoom > zoom);
          const replaceIndex = nextStopIndex === -1
            ? zoomConfig.stops.length - 1
            : Math.max(0, nextStopIndex - 1);

          if (index === replaceIndex && !isSnappedToPreset) {
            return {
              label: formatZoomDisplay(zoom, zoomConfig.neutralZoom),
              zoom: zoom,
              isDynamic: true,
              originalStop: stop,
            };
          }

          return stop;
        });

        return (
          <Animated.View style={[styles.zoomContainer, { top: Animated.add(animatedTopMargin, Animated.add(animatedHeight, -50)) }]}>
            {displayItems.map((item, index) => {
              const isDynamic = 'isDynamic' in item && item.isDynamic;
              const isSelected = !isDynamic && Math.abs(item.zoom - zoom) < 0.01;

              if (isDynamic) {
                return (
                  <View key={`dynamic-${index}`}>
                    <RotatableView rotation={uiRotation}>
                      <View style={[styles.zoomButton, styles.zoomButtonDynamic]}>
                        <Text style={styles.zoomText}>
                          {item.label}
                        </Text>
                      </View>
                    </RotatableView>
                  </View>
                );
              }

              return (
                <RotatableView key={item.label} rotation={uiRotation}>
                  <TouchableOpacity
                    onPress={() => setZoom(item.zoom)}
                    style={[
                      styles.zoomButton,
                      isSelected && styles.zoomButtonActive,
                    ]}
                  >
                    <Text style={[styles.zoomText, isSelected && styles.zoomTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                </RotatableView>
              );
            })}
          </Animated.View>
        );
      })()}

      {/* Controls Area (Bottom) */}
      <View style={styles.bottomBar}>

        {/* Main Controls Background */}
        <View style={[styles.controlsBackground, { paddingBottom: Math.max(0, insets.bottom - 10) }]}>
          {/* Mode Selector */}
          <View style={styles.modeTextWrapper}>
            {!scan.isScanMode ? (
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <Text style={styles.modeText}>PHOTO</Text>
                <TouchableOpacity onPress={scan.enterScanMode}>
                  <Text style={[styles.modeText, { color: 'white', opacity: 0.6 }]}>SCAN</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <TouchableOpacity onPress={scan.exitScanMode}>
                  <Text style={[styles.modeText, { color: 'white', opacity: 0.6 }]}>PHOTO</Text>
                </TouchableOpacity>
                <Text style={[styles.modeText, { color: '#00ff88' }]}>SCAN</Text>
              </View>
            )}
          </View>

          {/* Main Control Bar */}
          <View style={styles.controlBar}>
            {/* Gallery Thumbnail */}
            <TouchableOpacity
              style={styles.sideButton}
              onPress={() => {
                (navigation as any).navigate('Gallery');
              }}
            >
              <View style={styles.thumbnailFrame}>
                <RotatableView rotation={uiRotation}>
                  {lastPhoto ? (
                    <ExpoImage source={{ uri: lastPhoto }} style={styles.thumbnailImage} />
                  ) : (
                    <View style={[styles.thumbnailImage, { backgroundColor: '#333' }]} />
                  )}
                </RotatableView>
              </View>
            </TouchableOpacity>

            {/* Shutter */}
            <CaptureButton onPress={handleCapture} disabled={!device || timer.isCountingDown} />

            {/* Switch Camera */}
            <RotatableView rotation={uiRotation}>
              <View style={styles.sideButton}>
                <IconButton
                  iconName="camera-reverse"
                  size={32}
                  onPress={toggleCamera}
                  style={styles.iconButtonBg}
                />
              </View>
            </RotatableView>
          </View>
        </View>
      </View>

    </View>
  );
};

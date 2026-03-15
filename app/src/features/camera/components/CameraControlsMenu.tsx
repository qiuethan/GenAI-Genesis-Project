import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { IconButton } from './IconButton';
import { IconName } from '../../../infra/icons';
import { TimerDuration, NightModeState, ExposureValue } from '../hooks';

interface ControlItemProps {
  icon: IconName;
  label?: string;
  isActive?: boolean;
  onPress: () => void;
}

const ControlItem = ({ icon, label, isActive, onPress }: ControlItemProps) => (
  <TouchableOpacity onPress={onPress} style={[styles.item, isActive && styles.itemActive]}>
    <View style={styles.iconWrapper}>
      <IconButton iconName={icon} size={20} color={isActive ? '#ffe81f' : 'white'} onPress={onPress} />
      {label && <Text style={[styles.labelText, isActive && styles.labelTextActive]}>{label}</Text>}
    </View>
  </TouchableOpacity>
);

interface TextControlItemProps {
  text: string;
  isActive?: boolean;
  onPress: () => void;
}

const TextControlItem = ({ text, isActive, onPress }: TextControlItemProps) => (
  <TouchableOpacity onPress={onPress} style={[styles.item, isActive && styles.itemActive]}>
    <Text style={[styles.textItem, isActive && styles.textItemActive]}>{text}</Text>
  </TouchableOpacity>
);

interface Props {
  isOpen: boolean;
  // Flash
  flashMode: 'off' | 'on' | 'auto' | 'torch';
  onFlashPress: () => void;
  // Timer
  timerDuration: TimerDuration;
  onTimerPress: () => void;
  // Night Mode
  nightMode: NightModeState;
  onNightModePress: () => void;
  // Exposure
  exposure: ExposureValue;
  onExposurePress: () => void;
}

export const CameraControlsMenu = ({
  isOpen,
  flashMode,
  onFlashPress,
  timerDuration,
  onTimerPress,
  nightMode,
  onNightModePress,
  exposure,
  onExposurePress,
}: Props) => {
  if (!isOpen) return null;

  const getFlashIcon = (): IconName => {
    switch (flashMode) {
      case 'on': return 'flash';
      case 'auto': return 'flash-outline';
      case 'torch': return 'flashlight';
      default: return 'flash-off';
    }
  };

  const getTimerLabel = (): string | undefined => {
    if (timerDuration === 0) return undefined;
    return `${timerDuration}s`;
  };

  const getNightModeLabel = (): string | undefined => {
    if (nightMode === 'off') return undefined;
    return nightMode.toUpperCase();
  };

  const getExposureLabel = (): string | undefined => {
    if (exposure === 0) return undefined;
    return exposure > 0 ? `+${exposure}` : `${exposure}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ControlItem 
          icon={getFlashIcon()} 
          isActive={flashMode !== 'off'}
          onPress={onFlashPress}
        />
        
        <ControlItem
          icon="timer" 
          label={getTimerLabel()}
          isActive={timerDuration > 0}
          onPress={onTimerPress}
        />

        <ControlItem 
          icon="moon" 
          label={getNightModeLabel()}
          isActive={nightMode !== 'off'}
          onPress={onNightModePress}
        />

        <ControlItem 
          icon="aperture" 
          label={getExposureLabel()}
          isActive={exposure !== 0}
          onPress={onExposurePress}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    flexGrow: 1,
    justifyContent: 'center',
  },
  item: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  itemActive: {
    backgroundColor: 'rgba(255, 232, 31, 0.2)',
  },
  iconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginRight: 4,
  },
  labelTextActive: {
    color: '#ffe81f',
  },
  textItem: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  textItemActive: {
    color: '#ffe81f',
  },
});

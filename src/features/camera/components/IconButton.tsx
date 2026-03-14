import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Icon, IconName } from '../../../infra/icons';

interface Props {
  iconName: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const IconButton = ({ iconName, onPress, size = 28, color = 'white', style }: Props) => {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.container, style]}>
      <Icon name={iconName} size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
});

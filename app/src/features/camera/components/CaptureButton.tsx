import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

export const CaptureButton = ({ onPress, disabled }: Props) => {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={styles.container}>
      <View style={styles.outerCircle}>
        <View style={styles.innerCircle} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
  },
});

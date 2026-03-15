import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CameraScreen, GalleryScreen, ImageViewerScreen } from '../../../features/camera/api';
import type { CameraStackParamList } from '../types';

const Stack = createNativeStackNavigator<CameraStackParamList>();

export function CameraStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Camera" component={CameraScreen} />
      <Stack.Screen name="Gallery" component={GalleryScreen} />
      <Stack.Screen name="ImageViewer" component={ImageViewerScreen} />
    </Stack.Navigator>
  );
}

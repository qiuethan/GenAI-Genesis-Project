import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChallengesListScreen } from '../../../features/challenges/screens/ChallengesListScreen';
import { ChallengeDetailScreen } from '../../../features/challenges/screens/ChallengeDetailScreen';
import { SubmitPhotoScreen } from '../../../features/challenges/screens/SubmitPhotoScreen';
import type { ChallengesStackParamList } from '../types';

const Stack = createNativeStackNavigator<ChallengesStackParamList>();

export function ChallengesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChallengesList" component={ChallengesListScreen} />
      <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
      <Stack.Screen
        name="SubmitPhoto"
        component={SubmitPhotoScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

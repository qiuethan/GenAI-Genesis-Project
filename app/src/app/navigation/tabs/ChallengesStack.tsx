import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChallengesListScreen } from '../../../features/challenges/screens/ChallengesListScreen';
import { ChallengeDetailScreen } from '../../../features/challenges/screens/ChallengeDetailScreen';
import { SubmitPhotoScreen } from '../../../features/challenges/screens/SubmitPhotoScreen';
import { UserProfileScreen } from '../../../features/profile/screens/UserProfileScreen';
import { FollowersListScreen } from '../../../features/profile/screens/FollowersListScreen';
import { FollowingListScreen } from '../../../features/profile/screens/FollowingListScreen';
import { PhotoViewerScreen } from '../../../shared/screens/PhotoViewerScreen';
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
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
      <Stack.Screen
        name="PhotoViewer"
        component={PhotoViewerScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}

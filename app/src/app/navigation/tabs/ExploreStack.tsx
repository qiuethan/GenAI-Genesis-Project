import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ExploreScreen } from '../../../features/explore/screens/ExploreScreen';
import { ChallengeDetailScreen } from '../../../features/challenges/screens/ChallengeDetailScreen';
import { UserProfileScreen } from '../../../features/profile/screens/UserProfileScreen';
import { FollowersListScreen } from '../../../features/profile/screens/FollowersListScreen';
import { FollowingListScreen } from '../../../features/profile/screens/FollowingListScreen';
import { PhotoViewerScreen } from '../../../shared/screens/PhotoViewerScreen';
import type { ExploreStackParamList } from '../types';

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Explore" component={ExploreScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
      <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
      <Stack.Screen
        name="PhotoViewer"
        component={PhotoViewerScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}

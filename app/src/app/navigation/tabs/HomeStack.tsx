import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../../../features/home/screens/HomeScreen';
import { ChallengeDetailScreen } from '../../../features/challenges/screens/ChallengeDetailScreen';
import { SubmitPhotoScreen } from '../../../features/challenges/screens/SubmitPhotoScreen';
import { UserProfileScreen } from '../../../features/profile/screens/UserProfileScreen';
import { UserSearchScreen } from '../../../features/profile/screens/UserSearchScreen';
import { FollowersListScreen } from '../../../features/profile/screens/FollowersListScreen';
import { FollowingListScreen } from '../../../features/profile/screens/FollowingListScreen';
import type { HomeStackParamList } from '../types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
      <Stack.Screen
        name="SubmitPhoto"
        component={SubmitPhotoScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="UserSearch" component={UserSearchScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../../../features/profile/screens/ProfileScreen';
import { EditProfileScreen } from '../../../features/profile/screens/EditProfileScreen';
import { SettingsScreen } from '../../../features/profile/screens/SettingsScreen';
import { NotificationSettingsScreen } from '../../../features/profile/screens/NotificationSettingsScreen';
import { PrivacySettingsScreen } from '../../../features/profile/screens/PrivacySettingsScreen';
import { ChallengeDetailScreen } from '../../../features/challenges/screens/ChallengeDetailScreen';
import { UserSearchScreen } from '../../../features/profile/screens/UserSearchScreen';
import { UserProfileScreen } from '../../../features/profile/screens/UserProfileScreen';
import { FollowersListScreen } from '../../../features/profile/screens/FollowersListScreen';
import { FollowingListScreen } from '../../../features/profile/screens/FollowingListScreen';
import { PhotoViewerScreen } from '../../../shared/screens/PhotoViewerScreen';
import type { ProfileStackParamList } from '../types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="UserSearch" component={UserSearchScreen} />
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

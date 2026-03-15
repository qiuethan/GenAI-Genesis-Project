import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// ---- Auth Stack ----

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

// ---- Main Tab Bar ----

export type MainTabParamList = {
  HomeTab: undefined;
  ExploreTab: undefined;
  CameraTab: undefined;
  ChallengesTab: undefined;
  ProfileTab: undefined;
};

// ---- Per-Tab Stack Param Lists ----

export type HomeStackParamList = {
  Home: undefined;
  ChallengeDetail: { challengeId: string };
  SubmissionDetail: { submissionId: string };
  SubmitPhoto: { challengeId: string };
  UserSearch: undefined;
  UserProfile: { userId: string };
  FollowersList: { userId: string };
  FollowingList: { userId: string };
};

export type ExploreStackParamList = {
  Explore: undefined;
  SubmissionDetail: { submissionId: string };
  UserProfile: { userId: string };
  FollowersList: { userId: string };
  FollowingList: { userId: string };
};

export type CameraStackParamList = {
  Camera: undefined;
  Gallery: undefined;
  ImageViewer: {
    imageUri: string;
    allPhotos?: string[];
    initialIndex?: number;
  };
  SubmitPhoto: {
    challengeId: string;
    photoUri: string;
  };
};

export type ChallengesStackParamList = {
  ChallengesList: undefined;
  ChallengeDetail: { challengeId: string };
  SubmitPhoto: { challengeId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  UserSearch: undefined;
  UserProfile: { userId: string };
  FollowersList: { userId: string };
  FollowingList: { userId: string };
};

// ---- Navigation prop helpers ----

export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;

export type HomeScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, 'Home'>;
export type ExploreScreenNavigationProp = NativeStackNavigationProp<ExploreStackParamList, 'Explore'>;
export type CameraScreenNavigationProp = NativeStackNavigationProp<CameraStackParamList, 'Camera'>;
export type GalleryScreenNavigationProp = NativeStackNavigationProp<CameraStackParamList, 'Gallery'>;
export type ImageViewerScreenNavigationProp = NativeStackNavigationProp<CameraStackParamList, 'ImageViewer'>;
export type ChallengesListNavigationProp = NativeStackNavigationProp<ChallengesStackParamList, 'ChallengesList'>;
export type ProfileScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;

// ---- Shared (for screens used in multiple stacks) ----
export type UserProfileScreensParamList = {
  UserProfile: { userId: string };
  FollowersList: { userId: string };
  FollowingList: { userId: string };
};

export type UserSearchScreensParamList = {
  UserSearch: undefined;
  UserProfile: { userId: string };
};

// ---- Route prop helpers ----

export type ImageViewerScreenRouteProp = RouteProp<CameraStackParamList, 'ImageViewer'>;
export type ChallengeDetailRouteProp = RouteProp<ChallengesStackParamList, 'ChallengeDetail'>;
export type SubmitPhotoRouteProp = RouteProp<CameraStackParamList, 'SubmitPhoto'>;

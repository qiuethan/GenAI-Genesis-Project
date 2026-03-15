import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { useAuth } from '../../auth/context/AuthContext';
import { useChallengeDetail } from '../hooks/useChallenges';
import { useUserSubmission } from '../hooks/useSubmissions';
import { submitPhoto, replaceSubmission } from '../services/submissionService';
import { COMPOSITION_LABELS } from '../../../shared/types/database';
import { hapticSuccess, hapticMedium } from '../../../shared/utils/haptics';
import { computeAndAwardBadge } from '../../../shared/services/badgeService';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../../app/navigation/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Props = {
  route: RouteProp<HomeStackParamList, 'SubmissionDetail'>;
  navigation: NativeStackNavigationProp<any>;
  challengeId: string;
};

export function SubmitPhotoScreen({ navigation, route }: any) {
  const challengeId = route?.params?.challengeId;
  const { user } = useAuth();
  const { challenge } = useChallengeDetail(challengeId ?? '');
  const { submission: existingSubmission, refetch: refetchSubmission } = useUserSubmission(challengeId, user?.id);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scoreResult, setScoreResult] = useState<number | null>(null);

  const compositionLabel = challenge
    ? (COMPOSITION_LABELS[challenge.composition_type] ?? challenge.composition_type)
    : '';

  const isSimulator = !Constants.isDevice;

  const pickFromLibrary = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo access',
          'Allow access to your photo library so you can choose a photo to submit.'
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setScoreResult(null);
    }
  };

  const takePhoto = async () => {
    if (isSimulator) {
      Alert.alert(
        'Simulator',
        "The camera isn't available in the iOS Simulator. Use \"Choose from Library\" instead. Add photos first by dragging image files onto the simulator window, or save images from Safari in the simulator.",
        [{ text: 'OK' }]
      );
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setScoreResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!photoUri || !user || !challenge) return;

    const isReplacement = !!existingSubmission;

    if (isReplacement) {
      Alert.alert(
        'Replace Submission',
        'This will replace your current submission and re-score it. Your rank may change.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: doSubmit },
        ]
      );
    } else {
      doSubmit();
    }
  };

  const doSubmit = async () => {
    if (!photoUri || !user || !challenge) return;
    setSubmitting(true);

    try {
      const params = {
        challengeId: challenge.id,
        userId: user.id,
        photoUri,
        compositionType: challenge.composition_type,
        caption: caption.trim() || undefined,
      };

      let result;
      if (existingSubmission) {
        result = await replaceSubmission({
          ...params,
          oldStoragePath: existingSubmission.photo_storage_path,
        });
      } else {
        result = await submitPhoto(params);
      }

      if (result?.score != null) {
        setScoreResult(result.score);
      }

      hapticSuccess();
      refetchSubmission();

      computeAndAwardBadge(user.id).then((badge) => {
        if (badge) {
          hapticMedium();
          Alert.alert('Badge Earned!', `You earned the ◈ ${badge} badge!`);
        }
      }).catch(() => {});

      Alert.alert(
        'Submitted!',
        result?.score != null
          ? `Score: ${(result.score * 100).toFixed(0)}`
          : 'Your photo has been submitted. Score pending.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Submission failed', err.message ?? 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {existingSubmission ? 'Replace Submission' : 'Submit Photo'}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Challenge info */}
          {challenge && (
            <View style={styles.challengeInfo}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <View style={styles.compositionTag}>
                <Text style={styles.compositionTagText}>◈ {compositionLabel}</Text>
              </View>
            </View>
          )}

          {/* Photo selection */}
          {photoUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photoUri }} style={styles.preview} />
              <TouchableOpacity
                style={styles.changePhoto}
                onPress={() => setPhotoUri(null)}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.changePhotoText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickPhotoButton} onPress={pickFromLibrary}>
              <Ionicons name="images" size={32} color="#fff" />
              <Text style={styles.photoOptionText}>Choose from Library</Text>
            </TouchableOpacity>
          )}

          {/* Caption */}
          {photoUri && (
            <View style={styles.captionSection}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption (optional)"
                placeholderTextColor="#555"
                value={caption}
                onChangeText={setCaption}
                maxLength={280}
                multiline
              />
              <Text style={styles.charCount}>{caption.length}/280</Text>
            </View>
          )}

          {/* Submit button */}
          {photoUri && (
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#000" />
                  <Text style={styles.submitButtonText}>
                    {existingSubmission ? 'Replace Submission' : 'Submit'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  challengeInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  challengeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  compositionTag: {
    backgroundColor: '#1a1a2e',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compositionTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8888ff',
  },
  pickPhotoButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 10,
    marginBottom: 24,
  },
  photoOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  previewContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  preview: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
    borderRadius: 16,
    backgroundColor: '#111',
  },
  changePhoto: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changePhotoText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  captionSection: {
    marginBottom: 24,
  },
  captionInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  charCount: {
    fontSize: 12,
    color: '#555',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});

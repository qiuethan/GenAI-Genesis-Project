import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/context/AuthContext';
import { supabase } from '../../../infra/supabase/client';
import { useUserProfile } from '../../../shared/hooks/useProfile';
import { uploadAvatar, deleteOldAvatars } from '../services/avatarService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../../app/navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;
};

export function EditProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile(user?.id);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-populate fields when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setAvatarUri(profile.avatar_url ?? null);
    }
  }, [profile]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarChanged(true);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      let newAvatarUrl = profile?.avatar_url ?? null;

      if (avatarChanged && avatarUri) {
        // Delete old avatars then upload new one
        await deleteOldAvatars(user.id);
        newAvatarUrl = await uploadAvatar(user.id, avatarUri);
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          display_name: displayName || null,
          bio: bio || null,
          avatar_url: newAvatarUrl,
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveText, saving && styles.saveDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Avatar Picker */}
        <TouchableOpacity style={styles.avatarSection} onPress={pickImage} activeOpacity={0.7}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {(profile?.username?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.cameraIconBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
          <Text style={styles.changePhotoText}>Change Profile Photo</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#666"
            value={displayName}
            onChangeText={setDisplayName}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Tell us about your photography..."
            placeholderTextColor="#666"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={160}
          />
          <Text style={styles.charCount}>{bio.length}/160</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cancelText: {
    fontSize: 16,
    color: '#888',
  },
  saveText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  saveDisabled: {
    opacity: 0.5,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#555',
  },
  cameraIconBadge: {
    position: 'absolute',
    top: 62,
    right: '50%',
    marginRight: -40,
    backgroundColor: '#333',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  changePhotoText: {
    marginTop: 8,
    fontSize: 14,
    color: '#4a9eff',
    fontWeight: '600',
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: '#555',
    textAlign: 'right',
  },
});

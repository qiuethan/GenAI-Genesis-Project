import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/context/AuthContext';
import { supabase } from '../../../infra/supabase/client';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../../app/navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;
};

export function EditProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('user_profiles')
      .update({
        display_name: displayName || null,
        bio: bio || null,
      })
      .eq('id', user.id);
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      navigation.goBack();
    }
  };

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
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

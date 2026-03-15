import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../../app/navigation/types';

const STORAGE_KEY = '@notification_settings';

type Settings = {
  pushEnabled: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  challengeReminders: boolean;
};

const DEFAULTS: Settings = {
  pushEnabled: true,
  likes: true,
  comments: true,
  follows: true,
  challengeReminders: true,
};

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'NotificationSettings'>;
};

export function NotificationSettingsScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    });
  }, []);

  const update = (key: keyof Settings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const rows: { key: keyof Settings; label: string; subtitle: string }[] = [
    { key: 'pushEnabled', label: 'Push Notifications', subtitle: 'Enable all push notifications' },
    { key: 'likes', label: 'Likes', subtitle: 'When someone likes your photo' },
    { key: 'comments', label: 'Comments', subtitle: 'When someone comments on your photo' },
    { key: 'follows', label: 'New Followers', subtitle: 'When someone follows you' },
    { key: 'challengeReminders', label: 'Challenge Reminders', subtitle: 'When a challenge is about to close' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.section}>
        {rows.map((row, i) => (
          <View
            key={row.key}
            style={[styles.row, i === rows.length - 1 && styles.rowLast]}
          >
            <View style={styles.rowTextContainer}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
            </View>
            <Switch
              value={row.key === 'pushEnabled' ? settings.pushEnabled : settings.pushEnabled && settings[row.key]}
              onValueChange={(v) => update(row.key, v)}
              disabled={row.key !== 'pushEnabled' && !settings.pushEnabled}
              trackColor={{ false: '#333', true: '#4a4aff' }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    color: '#fff',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

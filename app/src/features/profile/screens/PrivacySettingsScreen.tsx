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

const STORAGE_KEY = '@privacy_settings';

type Settings = {
  privateProfile: boolean;
  showActivityStatus: boolean;
  showInSearch: boolean;
};

const DEFAULTS: Settings = {
  privateProfile: false,
  showActivityStatus: true,
  showInSearch: true,
};

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'PrivacySettings'>;
};

export function PrivacySettingsScreen({ navigation }: Props) {
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
    { key: 'privateProfile', label: 'Private Profile', subtitle: 'Only approved followers can see your photos' },
    { key: 'showActivityStatus', label: 'Show Activity Status', subtitle: 'Let others see when you were last active' },
    { key: 'showInSearch', label: 'Appear in Search', subtitle: 'Allow others to find you in user search' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy</Text>
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
              value={settings[row.key]}
              onValueChange={(v) => update(row.key, v)}
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

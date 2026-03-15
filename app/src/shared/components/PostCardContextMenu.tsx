import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticMedium } from '../utils/haptics';
import { savePost, unsavePost } from '../services/savedPostService';

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  submissionId: string;
  photoUrl: string;
  currentUserId?: string;
  isOwnPost: boolean;
  compositionLabel: string;
  onSaved?: () => void;
}

export function PostCardContextMenu({
  visible,
  onClose,
  submissionId,
  photoUrl,
  currentUserId,
  isOwnPost,
  compositionLabel,
  onSaved,
}: ContextMenuProps) {
  const handleSave = async () => {
    if (!currentUserId) return;
    try {
      await savePost(currentUserId, submissionId);
      hapticMedium();
      onSaved?.();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save post.');
    }
  };

  const handleReport = () => {
    Alert.alert(
      'Report Post',
      'Are you sure you want to report this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Reported', 'Thank you. We will review this post.');
            onClose();
          },
        },
      ]
    );
  };

  const actions = [
    { icon: 'bookmark-outline' as const, label: 'Save', onPress: handleSave },
    ...(!isOwnPost
      ? [{ icon: 'flag-outline' as const, label: 'Report', onPress: handleReport, destructive: true }]
      : []),
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.menu}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.menuItem}
              onPress={action.onPress}
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={'destructive' in action ? '#ff4444' : '#fff'}
              />
              <Text
                style={[
                  styles.menuLabel,
                  'destructive' in action && styles.menuLabelDestructive,
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancelItem} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  menu: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 34,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  menuLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  menuLabelDestructive: {
    color: '#ff4444',
  },
  cancelItem: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
});

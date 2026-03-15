import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, ViewStyle } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

function SkeletonPulse({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.bone, style, { opacity }]} />;
}

export function PostCardSkeleton() {
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <SkeletonPulse style={styles.avatarBone} />
        <View style={styles.postHeaderText}>
          <SkeletonPulse style={styles.nameBone} />
          <SkeletonPulse style={styles.timeBone} />
        </View>
      </View>
      <SkeletonPulse style={styles.photoBone} />
      <View style={styles.postMeta}>
        <SkeletonPulse style={styles.tagBone} />
        <SkeletonPulse style={styles.challengeNameBone} />
      </View>
      <View style={styles.postActions}>
        <SkeletonPulse style={styles.actionBone} />
        <SkeletonPulse style={styles.actionBone} />
        <SkeletonPulse style={styles.actionBone} />
      </View>
    </View>
  );
}

export function ChallengeCardSkeleton() {
  return (
    <View style={styles.challengeCard}>
      <SkeletonPulse style={styles.challengeImageBone} />
      <View style={styles.challengeContent}>
        <SkeletonPulse style={styles.challengeTagBone} />
        <SkeletonPulse style={styles.challengeTitleBone} />
        <SkeletonPulse style={styles.challengeDescBone} />
      </View>
    </View>
  );
}

export function HeroCardSkeleton() {
  return (
    <View style={styles.heroCard}>
      <SkeletonPulse style={styles.heroCoverBone} />
      <View style={styles.heroContent}>
        <SkeletonPulse style={styles.heroTagBone} />
        <SkeletonPulse style={styles.heroTitleBone} />
        <SkeletonPulse style={styles.heroDescBone} />
        <SkeletonPulse style={styles.heroTimerBone} />
        <SkeletonPulse style={styles.heroButtonBone} />
      </View>
    </View>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <View style={styles.profileHeader}>
      <SkeletonPulse style={styles.profileAvatarBone} />
      <SkeletonPulse style={styles.profileNameBone} />
      <SkeletonPulse style={styles.profileBioBone} />
      <View style={styles.profileStatsRow}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonPulse key={i} style={styles.profileStatBone} />
        ))}
      </View>
    </View>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
  },
  postCard: {
    marginBottom: 2,
    paddingBottom: 8,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  avatarBone: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postHeaderText: {
    flex: 1,
    gap: 6,
  },
  nameBone: {
    width: 120,
    height: 12,
    borderRadius: 4,
  },
  timeBone: {
    width: 60,
    height: 10,
    borderRadius: 4,
  },
  photoBone: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    borderRadius: 0,
  },
  postMeta: {
    flexDirection: 'row',
    padding: 14,
    gap: 8,
  },
  tagBone: {
    width: 100,
    height: 24,
    borderRadius: 6,
  },
  challengeNameBone: {
    width: 80,
    height: 14,
    borderRadius: 4,
    marginTop: 5,
  },
  postActions: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 16,
  },
  actionBone: {
    width: 28,
    height: 22,
    borderRadius: 4,
  },
  challengeCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#111',
    borderRadius: 14,
    overflow: 'hidden',
  },
  challengeImageBone: {
    width: 100,
    height: 100,
    borderRadius: 0,
  },
  challengeContent: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  challengeTagBone: {
    width: 80,
    height: 16,
    borderRadius: 4,
  },
  challengeTitleBone: {
    width: 140,
    height: 14,
    borderRadius: 4,
  },
  challengeDescBone: {
    width: 180,
    height: 10,
    borderRadius: 4,
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  heroCoverBone: {
    width: SCREEN_WIDTH - 32,
    height: 200,
    borderRadius: 0,
  },
  heroContent: {
    padding: 16,
    gap: 10,
  },
  heroTagBone: {
    width: 100,
    height: 20,
    borderRadius: 6,
  },
  heroTitleBone: {
    width: 180,
    height: 22,
    borderRadius: 6,
  },
  heroDescBone: {
    width: 240,
    height: 14,
    borderRadius: 4,
  },
  heroTimerBone: {
    width: 120,
    height: 16,
    borderRadius: 4,
  },
  heroButtonBone: {
    width: '100%' as any,
    height: 48,
    borderRadius: 12,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  profileAvatarBone: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileNameBone: {
    width: 120,
    height: 18,
    borderRadius: 6,
  },
  profileBioBone: {
    width: 200,
    height: 12,
    borderRadius: 4,
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  profileStatBone: {
    width: 48,
    height: 36,
    borderRadius: 6,
  },
});

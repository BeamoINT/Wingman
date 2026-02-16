import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';

interface SafetyBannerProps {
  variant?: 'info' | 'compact' | 'emergency';
  onPress?: () => void;
}

export const SafetyBanner: React.FC<SafetyBannerProps> = ({
  variant = 'info',
  onPress,
}) => {
  const handlePress = async () => {
    await haptics.medium();
    onPress?.();
  };

  if (variant === 'emergency') {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={[colors.status.error, colors.status.warning]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emergencyContainer}
        >
          <Ionicons name="warning" size={24} color={colors.text.primary} />
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>Emergency SOS</Text>
            <Text style={styles.emergencySubtitle}>
              Tap to alert emergency contacts
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity onPress={handlePress} style={styles.compactContainer}>
        <View style={styles.compactIcon}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary.blue} />
        </View>
        <Text style={styles.compactText}>Safety features enabled</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <LinearGradient
        colors={[colors.primary.blueSoft, colors.primary.blueSoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.container}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={28} color={colors.primary.blue} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Your Safety is Our Priority</Text>
          <Text style={styles.subtitle}>
            All wingmen are ID and photo verified for your safety
          </Text>

          <View style={styles.features}>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
              <Text style={styles.featureText}>ID Verification</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
              <Text style={styles.featureText}>Emergency SOS</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
              <Text style={styles.featureText}>24/7 Support</Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: spacing.radius.xl,
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },

  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    gap: spacing.sm,
  },
  compactIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },

  // Emergency styles
  emergencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: spacing.radius.xl,
    gap: spacing.md,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  emergencySubtitle: {
    ...typography.presets.caption,
    color: colors.text.primary,
    marginTop: 2,
  },
});

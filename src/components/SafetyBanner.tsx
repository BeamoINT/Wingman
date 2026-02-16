import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { haptics } from '../utils/haptics';

interface SafetyBannerProps {
  variant?: 'info' | 'compact' | 'emergency';
  onPress?: () => void;
}

export const SafetyBanner: React.FC<SafetyBannerProps> = ({
  variant = 'info',
  onPress,
}) => {
  const { tokens } = useTheme();
  const { colors } = tokens;
  const styles = useThemedStyles((themeTokens) => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: themeTokens.spacing.md,
      borderRadius: themeTokens.spacing.radius.md,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.light,
      backgroundColor: themeTokens.colors.surface.level1,
      borderLeftWidth: 3,
      borderLeftColor: themeTokens.colors.accent.primary,
      gap: themeTokens.spacing.sm,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: themeTokens.spacing.radius.sm,
      backgroundColor: themeTokens.colors.accent.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
    },
    title: {
      ...themeTokens.typography.presets.bodyMedium,
      color: themeTokens.colors.text.primary,
      marginBottom: 2,
    },
    subtitle: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.secondary,
    },
    features: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: themeTokens.spacing.sm,
      marginTop: themeTokens.spacing.xs,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    featureText: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.tertiary,
    },
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: themeTokens.spacing.sm,
      backgroundColor: themeTokens.colors.surface.level1,
      borderRadius: themeTokens.spacing.radius.md,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
      gap: themeTokens.spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: themeTokens.colors.accent.primary,
    },
    compactIcon: {
      width: 26,
      height: 26,
      borderRadius: themeTokens.spacing.radius.sm,
      backgroundColor: themeTokens.colors.accent.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compactText: {
      ...themeTokens.typography.presets.bodySmall,
      color: themeTokens.colors.text.secondary,
      flex: 1,
    },
    emergencyContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: themeTokens.spacing.md,
      borderRadius: themeTokens.spacing.radius.md,
      gap: themeTokens.spacing.sm,
      borderWidth: 1,
      borderColor: themeTokens.colors.status.error,
      backgroundColor: themeTokens.colors.status.errorLight,
      borderLeftWidth: 3,
      borderLeftColor: themeTokens.colors.status.error,
    },
    emergencyContent: {
      flex: 1,
    },
    emergencyTitle: {
      ...themeTokens.typography.presets.bodyMedium,
      color: themeTokens.colors.text.primary,
    },
    emergencySubtitle: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.secondary,
      marginTop: 2,
    },
  }));

  const handlePress = async () => {
    await haptics.medium();
    onPress?.();
  };

  if (variant === 'emergency') {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        <View style={styles.emergencyContainer}>
          <Ionicons name="warning-outline" size={22} color={colors.status.error} />
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>Emergency SOS</Text>
            <Text style={styles.emergencySubtitle}>Tap to alert emergency contacts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </View>
      </TouchableOpacity>
    );
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity onPress={handlePress} style={styles.compactContainer}>
        <View style={styles.compactIcon}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.accent.primary} />
        </View>
        <Text style={styles.compactText}>Safety features enabled</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.accent.primary} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Your Safety is Our Priority</Text>
          <Text style={styles.subtitle}>
            All Wingmen are ID and photo verified before bookings.
          </Text>

          <View style={styles.features}>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={12} color={colors.status.success} />
              <Text style={styles.featureText}>ID Verification</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={12} color={colors.status.success} />
              <Text style={styles.featureText}>Emergency SOS</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={12} color={colors.status.success} />
              <Text style={styles.featureText}>24/7 Support</Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  );
};


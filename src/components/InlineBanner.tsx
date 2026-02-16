import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

type BannerVariant = 'info' | 'success' | 'warning' | 'error';

interface InlineBannerProps {
  title: string;
  message?: string;
  variant?: BannerVariant;
  icon?: keyof typeof Ionicons.glyphMap;
}

const variantToIcon: Record<BannerVariant, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  error: 'alert-circle',
};

export const InlineBanner: React.FC<InlineBannerProps> = ({
  title,
  message,
  variant = 'info',
  icon,
}) => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;

  const palette = {
    info: {
      text: colors.status.info,
      bg: colors.status.infoLight,
      border: colors.border.light,
    },
    success: {
      text: colors.status.success,
      bg: colors.status.successLight,
      border: colors.border.light,
    },
    warning: {
      text: colors.status.warning,
      bg: colors.status.warningLight,
      border: colors.border.light,
    },
    error: {
      text: colors.status.error,
      bg: colors.status.errorLight,
      border: colors.border.light,
    },
  }[variant];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: spacing.radius.lg,
          padding: spacing.md,
          gap: spacing.xs,
        },
      ]}
    >
      <View style={[styles.titleRow, { gap: spacing.xs }]}> 
        <Ionicons name={icon || variantToIcon[variant]} size={18} color={palette.text} />
        <Text
          style={{
            ...typography.presets.bodyMedium,
            color: colors.text.primary,
            flex: 1,
          }}
        >
          {title}
        </Text>
      </View>
      {message ? (
        <Text
          style={{
            ...typography.presets.bodySmall,
            color: colors.text.secondary,
          }}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

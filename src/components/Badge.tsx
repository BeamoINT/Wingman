import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gold' | 'verified' | 'premium';
  size?: 'small' | 'medium';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'small',
  icon,
  style,
}) => {
  const { tokens } = useTheme();
  const { colors } = tokens;
  const styles = useThemedStyles((themeTokens) => StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: themeTokens.spacing.radius.round,
      gap: themeTokens.spacing.xs,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
    },
    small: {
      paddingHorizontal: themeTokens.spacing.sm,
      paddingVertical: 4,
    },
    medium: {
      paddingHorizontal: themeTokens.spacing.md,
      paddingVertical: themeTokens.spacing.xs,
    },
    text: {
      fontWeight: themeTokens.typography.weights.medium,
    },
    smallText: {
      fontSize: themeTokens.typography.sizes.xxs,
    },
    mediumText: {
      fontSize: themeTokens.typography.sizes.xs,
    },
    accentRail: {
      borderLeftWidth: 2,
      borderLeftColor: themeTokens.colors.accent.primary,
    },
  }));

  const getBackgroundColor = () => {
    switch (variant) {
      case 'success':
        return colors.status.successLight;
      case 'warning':
        return colors.status.warningLight;
      case 'error':
        return colors.status.errorLight;
      case 'info':
      case 'verified':
      case 'premium':
        return colors.accent.soft;
      case 'gold':
        return colors.surface.level2;
      default:
        return colors.surface.level2;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'success':
        return colors.status.success;
      case 'warning':
        return colors.status.warning;
      case 'error':
        return colors.status.error;
      case 'info':
      case 'verified':
      case 'premium':
        return colors.accent.primary;
      case 'gold':
        return colors.text.secondary;
      default:
        return colors.text.secondary;
    }
  };

  const iconSize = size === 'small' ? 10 : 12;
  const textColor = getTextColor();

  return (
    <View
      style={[
        styles.base,
        size === 'small' ? styles.small : styles.medium,
        { backgroundColor: getBackgroundColor() },
        (variant === 'premium' || variant === 'verified') && styles.accentRail,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={iconSize} color={textColor} /> : null}
      <Text
        style={[
          styles.text,
          size === 'small' ? styles.smallText : styles.mediumText,
          { color: textColor },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};


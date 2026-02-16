import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

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
  const getBackgroundColor = () => {
    switch (variant) {
      case 'success':
        return colors.status.successLight;
      case 'warning':
        return colors.status.warningLight;
      case 'error':
        return colors.status.errorLight;
      case 'info':
        return colors.status.infoLight;
      case 'gold':
        return colors.primary.goldSoft;
      case 'verified':
        return colors.primary.blueSoft;
      case 'premium':
        return colors.verification.trustedLight;
      default:
        return colors.background.tertiary;
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
        return colors.status.info;
      case 'gold':
        return colors.primary.gold;
      case 'verified':
        return colors.primary.blue;
      case 'premium':
        return colors.verification.trusted;
      default:
        return colors.text.secondary;
    }
  };

  const iconSize = size === 'small' ? 10 : 12;
  const textColor = getTextColor();

  if (variant === 'premium') {
    return (
      <LinearGradient
        colors={[colors.primary.goldSoft, colors.verification.trustedLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.base,
          size === 'small' ? styles.small : styles.medium,
          styles.premiumBorder,
          style,
        ]}
      >
        {icon && (
          <Ionicons name={icon} size={iconSize} color={colors.primary.gold} />
        )}
        <Text
          style={[
            styles.text,
            size === 'small' ? styles.smallText : styles.mediumText,
            { color: colors.primary.gold },
          ]}
        >
          {label}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.base,
        size === 'small' ? styles.small : styles.medium,
        { backgroundColor: getBackgroundColor() },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={iconSize} color={textColor} />}
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

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: spacing.radius.round,
    gap: spacing.xs,
  },
  small: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  medium: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  premiumBorder: {
    borderWidth: 1,
    borderColor: colors.border.gold,
  },
  text: {
    fontWeight: typography.weights.medium,
  },
  smallText: {
    fontSize: typography.sizes.xxs,
  },
  mediumText: {
    fontSize: typography.sizes.xs,
  },
});

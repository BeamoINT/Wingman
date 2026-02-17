import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface AvatarProps {
  source?: string;
  name?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  showVerified?: boolean;
  verificationLevel?: 'basic' | 'verified' | 'premium';
  style?: ViewStyle;
}

const sizeMap = {
  small: 40,
  medium: 56,
  large: 80,
  xlarge: 120,
};

export const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  size = 'medium',
  showOnlineStatus = false,
  isOnline = false,
  showVerified = false,
  verificationLevel = 'basic',
  style,
}) => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const styles = useThemedStyles(createStyles);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const dimensions = sizeMap[size];
  const normalizedSource = useMemo(() => {
    if (typeof source !== 'string') {
      return null;
    }
    const trimmed = source.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [source]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [normalizedSource]);

  const shouldRenderImage = Boolean(normalizedSource) && !imageLoadFailed;
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const getVerificationColor = () => {
    switch (verificationLevel) {
      case 'premium':
        return colors.verification.premium;
      case 'verified':
        return colors.verification.verified;
      default:
        return colors.text.tertiary;
    }
  };

  const badgeSize = size === 'small' ? 14 : size === 'medium' ? 18 : size === 'large' ? 22 : 28;

  return (
    <View style={[styles.container, { width: dimensions, height: dimensions }, style]}>
      {shouldRenderImage ? (
        <Image
          source={{ uri: normalizedSource as string }}
          style={[
            styles.image,
            { width: dimensions, height: dimensions, borderRadius: dimensions / 2 },
          ]}
          onError={() => setImageLoadFailed(true)}
        />
      ) : (
        <LinearGradient
          colors={colors.gradients.primary}
          style={[
            styles.placeholder,
            { width: dimensions, height: dimensions, borderRadius: dimensions / 2 },
          ]}
        >
          <Text
            style={[
              styles.initials,
              { fontSize: dimensions * 0.4 },
            ]}
          >
            {initials}
          </Text>
        </LinearGradient>
      )}

      {showOnlineStatus && (
        <View
          style={[
            styles.onlineIndicator,
            {
              backgroundColor: isOnline ? colors.status.success : colors.text.tertiary,
              width: size === 'small' ? 10 : 14,
              height: size === 'small' ? 10 : 14,
              borderWidth: size === 'small' ? 2 : 3,
            },
          ]}
        />
      )}

      {showVerified && verificationLevel !== 'basic' && (
        <View
          style={[
            styles.verifiedBadge,
            {
              width: badgeSize,
              height: badgeSize,
              backgroundColor: getVerificationColor(),
            },
          ]}
        >
          <Ionicons
            name={verificationLevel === 'premium' ? 'star' : 'checkmark'}
            size={badgeSize * 0.6}
            color={colors.text.primary}
          />
        </View>
      )}
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: colors.background.tertiary,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 999,
    borderColor: colors.background.primary,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
});

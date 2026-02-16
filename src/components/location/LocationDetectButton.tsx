/**
 * LocationDetectButton Component
 * Button to auto-detect user's current location
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';

interface LocationDetectButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const LocationDetectButton: React.FC<LocationDetectButtonProps> = ({
  onPress,
  isLoading = false,
  disabled = false,
}) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      style={styles.container}
    >
      <LinearGradient
        colors={[tokens.colors.primary.blue, tokens.colors.primary.blueDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, (disabled || isLoading) && styles.disabled]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={tokens.colors.text.primary} />
        ) : (
          <Ionicons name="locate" size={20} color={tokens.colors.text.primary} />
        )}
        <Text style={styles.text}>
          {isLoading ? 'Detecting location...' : 'Use my current location'}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const createStyles = ({ spacing, typography, colors }: ThemeTokens) => StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radius.lg,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
});

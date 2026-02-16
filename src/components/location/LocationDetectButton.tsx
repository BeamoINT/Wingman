/**
 * LocationDetectButton Component
 * Button to auto-detect user's current location
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[styles.container, isDisabled && styles.disabled]}
    >
      <View style={styles.button}>
        {isLoading ? (
          <ActivityIndicator size="small" color={tokens.colors.accent.primary} />
        ) : (
          <Ionicons name="locate" size={20} color={tokens.colors.accent.primary} />
        )}
        <Text style={styles.text}>
          {isLoading ? 'Detecting location...' : 'Use my current location'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = ({ spacing, typography, colors }: ThemeTokens) => StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    ...typography.presets.button,
    color: colors.text.secondary,
  },
});

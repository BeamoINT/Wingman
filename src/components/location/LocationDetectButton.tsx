/**
 * LocationDetectButton Component
 * Button to auto-detect user's current location
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

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
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      style={styles.container}
    >
      <LinearGradient
        colors={['#4ECDC4', '#45B7AA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.gradient,
          (disabled || isLoading) && styles.disabled,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.text.primary} />
        ) : (
          <Ionicons name="locate" size={20} color={colors.text.primary} />
        )}
        <Text style={styles.text}>
          {isLoading ? 'Detecting location...' : 'Use my current location'}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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

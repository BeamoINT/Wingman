import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import type { ThemeTokens } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/useThemedStyles';

interface SelfieStepProps {
  selfieUri: string;
  onCapture: () => void;
  onRemove: () => void;
}

export const SelfieStep: React.FC<SelfieStepProps> = ({ selfieUri, onCapture, onRemove }) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  const guidelines = [
    'Good lighting, face clearly visible',
    'Look directly at the camera',
    'No sunglasses, hats, or coverings',
    'Use a neutral expression similar to your ID photo',
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Selfie Verification</Text>
      <Text style={styles.description}>
        Take a clear selfie. Your face will be compared against your uploaded ID.
      </Text>

      {selfieUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selfieUri }} style={styles.preview} />
          <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
            <Ionicons name="close-circle" size={24} color={colors.status.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.capture} onPress={onCapture}>
          <Ionicons name="camera" size={44} color={colors.accent.primary} />
          <Text style={styles.captureText}>Tap to Take Selfie</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.subhead}>Guidelines</Text>
      <View style={styles.guides}>
        {guidelines.map((item) => (
          <View key={item} style={styles.guideRow}>
            <Ionicons name="checkmark" size={15} color={colors.status.success} />
            <Text style={styles.guideText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  description: {
    ...typography.presets.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
  },
  preview: {
    width: '100%',
    height: 320,
  },
  removeButton: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.surface.level0,
  },
  capture: {
    minHeight: 260,
    borderRadius: spacing.radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  captureText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  subhead: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  guides: {
    gap: spacing.xs,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  guideText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
});

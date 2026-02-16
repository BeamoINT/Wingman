import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SelectableChip } from '../../../components';
import { useTheme } from '../../../context/ThemeContext';
import type { IdDocumentType } from '../../../types';
import type { ThemeTokens } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/useThemedStyles';

interface IdTypeItem {
  label: string;
  value: IdDocumentType;
  icon: keyof typeof Ionicons.glyphMap;
}

interface IdStepProps {
  idTypes: IdTypeItem[];
  selectedType: IdDocumentType;
  idDocumentUri: string;
  onSelectType: (type: IdDocumentType) => void;
  onRemove: () => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
}

export const IdStep: React.FC<IdStepProps> = ({
  idTypes,
  selectedType,
  idDocumentUri,
  onSelectType,
  onRemove,
  onPickCamera,
  onPickLibrary,
}) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ID Verification</Text>
      <Text style={styles.description}>
        Upload a clear photo of your government-issued ID to keep the community trusted.
      </Text>

      <Text style={styles.fieldLabel}>Document Type</Text>
      <View style={styles.chipsRow}>
        {idTypes.map((type) => (
          <SelectableChip
            key={type.value}
            label={type.label}
            icon={type.icon}
            selected={selectedType === type.value}
            onPress={() => onSelectType(type.value)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Upload Document</Text>

      {idDocumentUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: idDocumentUri }} style={styles.preview} resizeMode="contain" />
          <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
            <Ionicons name="close-circle" size={24} color={colors.status.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.uploadOptions}>
          <TouchableOpacity style={styles.uploadOption} onPress={onPickCamera}>
            <Ionicons name="camera" size={28} color={colors.accent.primary} />
            <Text style={styles.uploadOptionText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadOption} onPress={onPickLibrary}>
            <Ionicons name="images" size={28} color={colors.accent.primary} />
            <Text style={styles.uploadOptionText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tipCard}>
        <Ionicons name="information-circle" size={18} color={colors.accent.primary} />
        <Text style={styles.tipText}>
          Ensure all text is legible and avoid glare, blur, and shadows.
        </Text>
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
  fieldLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  previewContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: spacing.radius.xl,
    backgroundColor: colors.surface.level1,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  preview: {
    width: '100%',
    height: 220,
  },
  removeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.background.primary,
  },
  uploadOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  uploadOption: {
    flex: 1,
    minHeight: 120,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.light,
    backgroundColor: colors.surface.level1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  uploadOptionText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.status.infoLight,
    padding: spacing.md,
  },
  tipText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
});

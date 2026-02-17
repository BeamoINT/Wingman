import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectableChip } from '..';
import { useTheme } from '../../context/ThemeContext';
import { WINGMAN_LANGUAGES, WINGMAN_RATE_MAX, WINGMAN_RATE_MIN, WINGMAN_SPECIALTIES } from '../../constants/wingmanProfile';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { WingmanProfileSetupPayload } from '../../types';

export interface WingmanProfileFormErrors {
  specialties?: string;
  hourlyRate?: string;
  about?: string;
  languages?: string;
  gallery?: string;
}

interface WingmanProfileFormProps {
  value: WingmanProfileSetupPayload;
  errors?: WingmanProfileFormErrors;
  onChange: (next: WingmanProfileSetupPayload) => void;
  onAddGalleryPhoto: () => void;
  onRemoveGalleryPhoto: (index: number) => void;
  disabled?: boolean;
}

function normalizeRateInput(input: string): number {
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

export const WingmanProfileForm: React.FC<WingmanProfileFormProps> = ({
  value,
  errors,
  onChange,
  onAddGalleryPhoto,
  onRemoveGalleryPhoto,
  disabled = false,
}) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  const toggleSpecialty = (specialty: WingmanProfileSetupPayload['specialties'][number]) => {
    const exists = value.specialties.includes(specialty);
    onChange({
      ...value,
      specialties: exists
        ? value.specialties.filter((entry) => entry !== specialty)
        : [...value.specialties, specialty],
    });
  };

  const toggleLanguage = (language: string) => {
    const exists = value.languages.includes(language);
    onChange({
      ...value,
      languages: exists
        ? value.languages.filter((entry) => entry !== language)
        : [...value.languages, language],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.fieldLabel}>Services / Specialties (select at least 2)</Text>
      <View style={styles.chipsWrap}>
        {WINGMAN_SPECIALTIES.map((item) => (
          <SelectableChip
            key={item.value}
            label={item.label}
            icon={item.icon}
            selected={value.specialties.includes(item.value)}
            onPress={() => {
              if (!disabled) {
                toggleSpecialty(item.value);
              }
            }}
          />
        ))}
      </View>
      {errors?.specialties ? <Text style={styles.errorText}>{errors.specialties}</Text> : null}

      <Text style={styles.fieldLabel}>Hourly Rate</Text>
      <View style={styles.rateRow}>
        <Text style={styles.ratePrefix}>$</Text>
        <TextInput
          style={styles.rateInput}
          value={value.hourlyRate > 0 ? String(value.hourlyRate) : ''}
          onChangeText={(next) => {
            onChange({ ...value, hourlyRate: normalizeRateInput(next) });
          }}
          keyboardType="numeric"
          maxLength={3}
          editable={!disabled}
          placeholder={String(WINGMAN_RATE_MIN)}
          placeholderTextColor={colors.text.muted}
        />
        <Text style={styles.rateSuffix}>/ hour</Text>
      </View>
      <Text style={styles.fieldHint}>Min ${WINGMAN_RATE_MIN} - Max ${WINGMAN_RATE_MAX}. You keep 90% of each completed booking.</Text>
      {errors?.hourlyRate ? <Text style={styles.errorText}>{errors.hourlyRate}</Text> : null}

      <Text style={styles.fieldLabel}>About You</Text>
      <TextInput
        style={styles.textArea}
        value={value.about}
        onChangeText={(about) => onChange({ ...value, about })}
        placeholder="Describe your style, strengths, and the experiences you offer as a wingman..."
        placeholderTextColor={colors.text.muted}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        maxLength={500}
        editable={!disabled}
      />
      <Text style={styles.charCount}>{value.about.length}/500</Text>
      {errors?.about ? <Text style={styles.errorText}>{errors.about}</Text> : null}

      <Text style={styles.fieldLabel}>Languages</Text>
      <View style={styles.chipsWrap}>
        {WINGMAN_LANGUAGES.map((language) => (
          <SelectableChip
            key={language}
            label={language}
            selected={value.languages.includes(language)}
            onPress={() => {
              if (!disabled) {
                toggleLanguage(language);
              }
            }}
          />
        ))}
      </View>
      {errors?.languages ? <Text style={styles.errorText}>{errors.languages}</Text> : null}

      <View style={styles.availabilityRow}>
        <Text style={styles.fieldLabel}>Available for new bookings</Text>
        <TouchableOpacity
          style={[styles.availabilityToggle, value.isAvailable && styles.availabilityToggleOn]}
          onPress={() => {
            if (!disabled) {
              onChange({ ...value, isAvailable: !value.isAvailable });
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.availabilityText, value.isAvailable && styles.availabilityTextOn]}>
            {value.isAvailable ? 'Available' : 'Paused'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Gallery Photos (optional, max 6)</Text>
      <View style={styles.galleryGrid}>
        {value.gallery.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.galleryItem}>
            <Image source={{ uri }} style={styles.galleryImage} />
            <TouchableOpacity
              style={styles.galleryRemove}
              onPress={() => onRemoveGalleryPhoto(index)}
              disabled={disabled}
            >
              <Ionicons name="close-circle" size={20} color={colors.status.error} />
            </TouchableOpacity>
          </View>
        ))}

        {value.gallery.length < 6 ? (
          <TouchableOpacity
            style={styles.galleryAdd}
            onPress={onAddGalleryPhoto}
            disabled={disabled}
          >
            <Ionicons name="add" size={24} color={colors.text.tertiary} />
            <Text style={styles.galleryAddText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {errors?.gallery ? <Text style={styles.errorText}>{errors.gallery}</Text> : null}
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  fieldHint: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: -spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    paddingHorizontal: spacing.md,
  },
  ratePrefix: {
    ...typography.presets.h3,
    color: colors.accent.primary,
  },
  rateInput: {
    ...typography.presets.h3,
    color: colors.text.primary,
    flex: 1,
    paddingVertical: spacing.md,
    marginLeft: spacing.xs,
  },
  rateSuffix: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  textArea: {
    ...typography.presets.body,
    color: colors.text.primary,
    minHeight: 120,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    padding: spacing.md,
  },
  charCount: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: -spacing.xs,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityToggle: {
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.surface.level1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  availabilityToggleOn: {
    borderColor: colors.status.success,
    backgroundColor: colors.status.successLight,
  },
  availabilityText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  availabilityTextOn: {
    color: colors.status.success,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  galleryItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryRemove: {
    position: 'absolute',
    right: 4,
    top: 4,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.surface.level0,
  },
  galleryAdd: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryAddText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.error,
    marginTop: -spacing.xs,
  },
});

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectableChip } from '../../../components';
import { useTheme } from '../../../context/ThemeContext';
import type { ThemeTokens } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import type { CompanionSpecialty } from '../../../types';

interface SpecialtyItem {
  label: string;
  value: CompanionSpecialty;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ProfileStepProps {
  specialties: SpecialtyItem[];
  languages: string[];
  selectedSpecialties: CompanionSpecialty[];
  hourlyRate: number;
  about: string;
  selectedLanguages: string[];
  gallery: string[];
  minRate: number;
  maxRate: number;
  onToggleSpecialty: (value: CompanionSpecialty) => void;
  onHourlyRateChange: (rate: number) => void;
  onAboutChange: (value: string) => void;
  onToggleLanguage: (language: string) => void;
  onAddGallery: () => void;
  onRemoveGallery: (index: number) => void;
}

export const ProfileStep: React.FC<ProfileStepProps> = ({
  specialties,
  languages,
  selectedSpecialties,
  hourlyRate,
  about,
  selectedLanguages,
  gallery,
  minRate,
  maxRate,
  onToggleSpecialty,
  onHourlyRateChange,
  onAboutChange,
  onToggleLanguage,
  onAddGallery,
  onRemoveGallery,
}) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Setup</Text>
      <Text style={styles.description}>
        Set up your wingman profile. This is what clients see while browsing.
      </Text>

      <Text style={styles.fieldLabel}>Specialties (select at least 2)</Text>
      <View style={styles.chipsWrap}>
        {specialties.map((item) => (
          <SelectableChip
            key={item.value}
            label={item.label}
            icon={item.icon}
            selected={selectedSpecialties.includes(item.value)}
            onPress={() => onToggleSpecialty(item.value)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Hourly Rate</Text>
      <View style={styles.rateRow}>
        <Text style={styles.ratePrefix}>$</Text>
        <TextInput
          style={styles.rateInput}
          value={hourlyRate > 0 ? hourlyRate.toString() : ''}
          onChangeText={(value) => {
            const parsed = parseInt(value, 10);
            onHourlyRateChange(Number.isNaN(parsed) ? 0 : parsed);
          }}
          keyboardType="numeric"
          maxLength={3}
          placeholder="25"
          placeholderTextColor={colors.text.muted}
        />
        <Text style={styles.rateSuffix}>/ hour</Text>
      </View>
      <Text style={styles.fieldHint}>Min ${minRate} - Max ${maxRate}. You keep 90% of each booking.</Text>

      <Text style={styles.fieldLabel}>About You</Text>
      <TextInput
        style={styles.textArea}
        value={about}
        onChangeText={onAboutChange}
        placeholder="Tell potential clients about yourself, your experience, and what makes you a great wingman..."
        placeholderTextColor={colors.text.muted}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        maxLength={500}
      />
      <Text style={styles.charCount}>{about.length}/500</Text>

      <Text style={styles.fieldLabel}>Languages</Text>
      <View style={styles.chipsWrap}>
        {languages.map((language) => (
          <SelectableChip
            key={language}
            label={language}
            selected={selectedLanguages.includes(language)}
            onPress={() => onToggleLanguage(language)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Gallery Photos (optional, up to 6)</Text>
      <View style={styles.galleryGrid}>
        {gallery.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.galleryItem}>
            <Image source={{ uri }} style={styles.galleryImage} />
            <TouchableOpacity style={styles.galleryRemove} onPress={() => onRemoveGallery(index)}>
              <Ionicons name="close-circle" size={20} color={colors.status.error} />
            </TouchableOpacity>
          </View>
        ))}

        {gallery.length < 6 ? (
          <TouchableOpacity style={styles.galleryAdd} onPress={onAddGallery}>
            <Ionicons name="add" size={26} color={colors.text.tertiary} />
          </TouchableOpacity>
        ) : null}
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
    borderColor: colors.border.light,
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
    borderColor: colors.border.light,
    backgroundColor: colors.surface.level1,
    padding: spacing.md,
  },
  charCount: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: -spacing.xs,
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
    backgroundColor: colors.background.primary,
  },
  galleryAdd: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.light,
    backgroundColor: colors.surface.level1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

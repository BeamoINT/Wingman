import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components';
import { useTheme } from '../../../context/ThemeContext';
import type { ThemeTokens } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import type { CompanionOnboardingData, IdDocumentType } from '../../../types';

interface IdTypeItem {
  label: string;
  value: IdDocumentType;
}

interface ReviewStepProps {
  data: CompanionOnboardingData;
  idTypes: IdTypeItem[];
}

export const ReviewStep: React.FC<ReviewStepProps> = ({ data, idTypes }) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review & Submit</Text>
      <Text style={styles.description}>
        Review your application before submitting. You can go back to edit anything.
      </Text>

      <Card variant="gradient" style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Application Summary</Text>

        <View style={styles.summaryRow}>
          <Ionicons name="card" size={16} color={colors.accent.primary} />
          <Text style={styles.summaryLabel}>ID Document</Text>
          <Text style={styles.summaryValue}>
            {idTypes.find((type) => type.value === data.idDocumentType)?.label || 'Selected'}
          </Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
        </View>

        <View style={styles.summaryRow}>
          <Ionicons name="camera" size={16} color={colors.accent.primary} />
          <Text style={styles.summaryLabel}>Selfie</Text>
          <Text style={styles.summaryValue}>Captured</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
        </View>

        <View style={styles.summaryRow}>
          <Ionicons name="star" size={16} color={colors.accent.primary} />
          <Text style={styles.summaryLabel}>Specialties</Text>
          <Text style={styles.summaryValue}>{data.specialties.length} selected</Text>
        </View>

        <View style={styles.summaryRow}>
          <Ionicons name="cash" size={16} color={colors.accent.primary} />
          <Text style={styles.summaryLabel}>Rate</Text>
          <Text style={styles.summaryValue}>${data.hourlyRate}/hr</Text>
        </View>

        <View style={styles.summaryRow}>
          <Ionicons name="language" size={16} color={colors.accent.primary} />
          <Text style={styles.summaryLabel}>Languages</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>{data.languages.join(', ')}</Text>
        </View>

        {data.gallery.length > 0 ? (
          <View style={styles.summaryRow}>
            <Ionicons name="images" size={16} color={colors.accent.primary} />
            <Text style={styles.summaryLabel}>Gallery</Text>
            <Text style={styles.summaryValue}>{data.gallery.length} photos</Text>
          </View>
        ) : null}

        <View style={styles.summaryRowEnd}>
          <Ionicons name="document-text" size={16} color={colors.accent.primary} />
          <Text style={styles.summaryLabel}>Agreement</Text>
          <Text style={styles.summaryValue}>Accepted</Text>
          <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
        </View>
      </Card>

      <Card variant="outlined">
        <View style={styles.noteRow}>
          <Ionicons name="information-circle" size={18} color={colors.accent.primary} />
          <Text style={styles.noteText}>
            Your application will be reviewed in 1-3 business days. We&apos;ll notify you once a decision is made.
          </Text>
        </View>
      </Card>
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
  summaryCard: {
    gap: spacing.xs,
  },
  summaryTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  summaryRowEnd: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryLabel: {
    ...typography.presets.body,
    color: colors.text.secondary,
    flex: 1,
  },
  summaryValue: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    maxWidth: '50%',
    textAlign: 'right',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  noteText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
    flex: 1,
  },
});

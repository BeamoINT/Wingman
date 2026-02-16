import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../../../components';
import { useTheme } from '../../../context/ThemeContext';
import type { ThemeTokens } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/useThemedStyles';

interface AgreementStepProps {
  accepted: boolean;
  onToggleAccepted: () => void;
}

const agreementSections = [
  {
    title: '1. Service Standards',
    body: 'Provide professional, respectful wingman services. Arrive on time and maintain a positive, friendly presence throughout each booking.',
  },
  {
    title: '2. Safety & Conduct',
    body: 'Follow community and safety policies. Illegal activity, harassment, discrimination, or inappropriate behavior is prohibited.',
  },
  {
    title: '3. Identity Verification',
    body: 'All submitted identity materials must be authentic and belong to you.',
  },
  {
    title: '4. Payment Terms',
    body: 'You receive 90% of each booking total. Wingman retains 10% as the platform fee.',
  },
  {
    title: '5. Cancellation Policy',
    body: 'Repeated late cancellations and no-shows may result in penalties or suspension.',
  },
  {
    title: '6. Privacy & Data',
    body: 'Verification documents are secured and used only for platform safety workflows.',
  },
  {
    title: '7. Account Termination',
    body: 'Wingman may suspend or terminate accounts that violate policy or applicable laws.',
  },
];

export const AgreementStep: React.FC<AgreementStepProps> = ({ accepted, onToggleAccepted }) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wingman Agreement</Text>
      <Text style={styles.description}>
        Please review and accept the Wingman Service Agreement to continue.
      </Text>

      <Card variant="outlined" style={styles.agreementCard}>
        <ScrollView style={styles.agreementScroll} nestedScrollEnabled>
          <Text style={styles.heading}>Wingman Service Agreement</Text>
          <Text style={styles.body}>
            By accepting, you agree to the following terms as a wingman on the Wingman platform.
          </Text>

          {agreementSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.body}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </Card>

      <TouchableOpacity style={styles.checkboxRow} onPress={onToggleAccepted} activeOpacity={0.7}>
        <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
          {accepted ? <Ionicons name="checkmark" size={14} color={colors.surface.level0} /> : null}
        </View>
        <Text style={styles.checkboxLabel}>
          I have read, understood, and agree to the Wingman Service Agreement.
        </Text>
      </TouchableOpacity>
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
  agreementCard: {
    maxHeight: 360,
    overflow: 'hidden',
  },
  agreementScroll: {
    padding: spacing.lg,
  },
  heading: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  body: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primary,
  },
  checkboxLabel: {
    ...typography.presets.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 22,
  },
});

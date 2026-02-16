import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components';
import { useTheme } from '../../../context/ThemeContext';
import type { ThemeTokens } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/useThemedStyles';

export const WelcomeStep: React.FC = () => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  const items = [
    {
      icon: 'shield-checkmark' as const,
      title: 'Verify Your Identity',
      description: 'Upload your ID and take a selfie for safety.',
    },
    {
      icon: 'person' as const,
      title: 'Set Up Your Profile',
      description: 'Choose specialties, rate, and a clear introduction.',
    },
    {
      icon: 'document-text' as const,
      title: 'Accept Agreement',
      description: 'Review and accept the Wingman Service Agreement.',
    },
    {
      icon: 'checkmark-circle' as const,
      title: 'Get Approved',
      description: 'Applications are reviewed in 1-3 business days.',
    },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={colors.gradients.premium}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Ionicons name="people" size={40} color={colors.primary.darkBlack} />
        <Text style={styles.heroTitle}>Become a Wingman</Text>
        <Text style={styles.heroSubtitle}>
          Earn money by being a great friend. Set your own hours, choose activities, and get paid for your time.
        </Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        {items.map((item) => (
          <View key={item.title} style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name={item.icon} size={18} color={colors.accent.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <Card variant="outlined" style={styles.earningCard}>
        <Ionicons name="cash-outline" size={22} color={colors.accent.primary} />
        <View style={styles.earningCopy}>
          <Text style={styles.earningTitle}>Earning Potential</Text>
          <Text style={styles.earningDescription}>
            Wingmen earn $15-200/hour depending on specialty and experience. You keep 90% of every booking.
          </Text>
        </View>
      </Card>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  hero: {
    borderRadius: spacing.radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroTitle: {
    ...typography.presets.h2,
    color: colors.primary.darkBlack,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.presets.body,
    color: colors.primary.darkBlack,
    opacity: 0.84,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  rowDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  earningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  earningCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  earningTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  earningDescription: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});

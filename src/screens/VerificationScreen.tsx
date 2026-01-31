import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Card, Button, Badge } from '../components';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: 'completed' | 'in_progress' | 'pending';
  action?: string;
}

const verificationSteps: VerificationStep[] = [
  {
    id: 'email',
    title: 'Email Verification',
    description: 'Verify your email address',
    icon: 'mail',
    status: 'completed',
  },
  {
    id: 'phone',
    title: 'Phone Verification',
    description: 'Verify your phone number',
    icon: 'call',
    status: 'completed',
  },
  {
    id: 'id',
    title: 'ID Verification',
    description: 'Upload a government-issued ID',
    icon: 'card',
    status: 'in_progress',
    action: 'Continue',
  },
  {
    id: 'background',
    title: 'Background Check',
    description: 'Complete a background screening',
    icon: 'shield-checkmark',
    status: 'pending',
    action: 'Start',
  },
];

export const VerificationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const completedSteps = verificationSteps.filter((s) => s.status === 'completed').length;
  const totalSteps = verificationSteps.length;
  const progress = (completedSteps / totalSteps) * 100;

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const getStatusColor = (status: VerificationStep['status']) => {
    switch (status) {
      case 'completed':
        return colors.status.success;
      case 'in_progress':
        return colors.primary.blue;
      case 'pending':
        return colors.text.tertiary;
    }
  };

  const getStatusIcon = (status: VerificationStep['status']): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'in_progress':
        return 'time';
      case 'pending':
        return 'ellipse-outline';
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Card */}
        <View style={styles.section}>
          <Card variant="gradient" style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressTitle}>Verification Progress</Text>
                <Text style={styles.progressSubtitle}>
                  {completedSteps} of {totalSteps} steps completed
                </Text>
              </View>
              <View style={styles.progressBadge}>
                <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
              </View>
            </View>

            <View style={styles.progressBar}>
              <LinearGradient
                colors={colors.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
          </Card>
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why Get Verified?</Text>

          <View style={styles.benefitsGrid}>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="star" size={20} color={colors.primary.gold} />
              </View>
              <Text style={styles.benefitText}>Earn trust badges</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="trending-up" size={20} color={colors.status.success} />
              </View>
              <Text style={styles.benefitText}>Higher visibility</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="people" size={20} color={colors.primary.blue} />
              </View>
              <Text style={styles.benefitText}>More bookings</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="shield" size={20} color={colors.verification.trusted} />
              </View>
              <Text style={styles.benefitText}>Build trust</Text>
            </View>
          </View>
        </View>

        {/* Verification Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Steps</Text>

          {verificationSteps.map((step, index) => (
            <Card
              key={step.id}
              variant="outlined"
              style={[
                styles.stepCard,
                step.status === 'in_progress' && styles.stepCardActive,
              ]}
            >
              <View style={styles.stepRow}>
                <View
                  style={[
                    styles.stepIcon,
                    { backgroundColor: `${getStatusColor(step.status)}20` },
                  ]}
                >
                  <Ionicons name={step.icon} size={24} color={getStatusColor(step.status)} />
                </View>

                <View style={styles.stepContent}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Ionicons
                      name={getStatusIcon(step.status)}
                      size={20}
                      color={getStatusColor(step.status)}
                    />
                  </View>
                  <Text style={styles.stepDescription}>{step.description}</Text>

                  {step.action && (
                    <Button
                      title={step.action}
                      onPress={() => haptics.medium()}
                      variant={step.status === 'in_progress' ? 'primary' : 'outline'}
                      size="small"
                      style={styles.stepButton}
                    />
                  )}
                </View>
              </View>

              {index < verificationSteps.length - 1 && (
                <View style={styles.connector}>
                  <View
                    style={[
                      styles.connectorLine,
                      step.status === 'completed' && styles.connectorLineComplete,
                    ]}
                  />
                </View>
              )}
            </Card>
          ))}
        </View>

        {/* Background Check Info */}
        <View style={styles.section}>
          <Card variant="outlined" style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={colors.primary.blue} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>About Background Checks</Text>
              <Text style={styles.infoDescription}>
                Our background checks are conducted by a trusted third-party provider. The process typically takes 2-5 business days and includes criminal record, identity, and reference verification.
              </Text>
            </View>
          </Card>
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={16} color={colors.text.tertiary} />
          <Text style={styles.privacyText}>
            Your information is encrypted and securely stored. We never share your personal data without your consent.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: spacing.screenPadding,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  progressCard: {
    padding: spacing.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  progressTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  progressSubtitle: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  progressBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  benefitItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.card,
    padding: spacing.md,
    borderRadius: spacing.radius.lg,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  stepCard: {
    marginBottom: spacing.md,
    position: 'relative',
  },
  stepCardActive: {
    borderColor: colors.primary.blue,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  stepDescription: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  stepButton: {
    alignSelf: 'flex-start',
  },
  connector: {
    position: 'absolute',
    left: spacing.lg + 24,
    bottom: -spacing.md - 4,
    height: spacing.md + 8,
    width: 2,
  },
  connectorLine: {
    flex: 1,
    backgroundColor: colors.border.light,
  },
  connectorLineComplete: {
    backgroundColor: colors.status.success,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  infoDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.screenPadding,
    paddingTop: 0,
  },
  privacyText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    flex: 1,
    lineHeight: 18,
  },
});

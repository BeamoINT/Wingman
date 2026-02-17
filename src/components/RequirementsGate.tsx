import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
/**
 * Requirements Gate Component
 *
 * A wrapper component that enforces requirements before allowing access to content.
 * Shows a modal with unmet requirements and actions to fulfill them.
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Modal,
    ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRequirements, type AppFeature, type RequirementCheck } from '../context/RequirementsContext';
import type { LegalDocumentType, RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';
import { Button } from './Button';
import { Card } from './Card';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface RequirementsGateProps {
  /**
   * The feature to check requirements for
   */
  feature: AppFeature;

  /**
   * Content to render if requirements are met
   */
  children: React.ReactNode;

  /**
   * Custom title for the requirements modal
   */
  modalTitle?: string;

  /**
   * Whether to show a loading state while checking requirements
   */
  showLoading?: boolean;

  /**
   * Callback when requirements are not met
   */
  onRequirementsNotMet?: (unmetRequirements: RequirementCheck[]) => void;

  /**
   * Callback when all requirements are met
   */
  onRequirementsMet?: () => void;

  /**
   * Custom fallback component when requirements are not met
   * If not provided, shows the default requirements modal
   */
  fallback?: React.ReactNode;
}

export const RequirementsGate: React.FC<RequirementsGateProps> = ({
  feature,
  children,
  modalTitle = 'Requirements Not Met',
  showLoading = true,
  onRequirementsNotMet,
  onRequirementsMet,
  fallback,
}) => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { checkBookingRequirements, checkCompanionRequirements, canAccessFeature, isLoading } =
    useRequirements();

  const [showModal, setShowModal] = useState(false);
  const [requirements, setRequirements] = useState<RequirementCheck[]>([]);
  const [allMet, setAllMet] = useState(false);

  // Check requirements
  useEffect(() => {
    if (isLoading) return;

    let unmetReqs: RequirementCheck[] = [];
    let met = false;

    if (feature === 'book_companion') {
      const bookingReqs = checkBookingRequirements('finalize');
      unmetReqs = bookingReqs.unmetRequirements;
      met = bookingReqs.allMet;
    } else if (feature === 'send_message' || feature === 'leave_review') {
      const bookingReqs = checkBookingRequirements('entry');
      unmetReqs = bookingReqs.unmetRequirements;
      met = bookingReqs.allMet;
    } else if (feature === 'become_companion') {
      const companionReqs = checkCompanionRequirements();
      unmetReqs = companionReqs.unmetRequirements;
      met = companionReqs.allMet;
    } else {
      const featureCheck = canAccessFeature(feature);
      met = featureCheck.met;
      if (!met) {
        unmetReqs = [featureCheck];
      }
    }

    setRequirements(unmetReqs);
    setAllMet(met);

    if (met) {
      onRequirementsMet?.();
    } else {
      onRequirementsNotMet?.(unmetReqs);
      if (!fallback) {
        setShowModal(true);
      }
    }
  }, [
    feature,
    isLoading,
    checkBookingRequirements,
    checkCompanionRequirements,
    canAccessFeature,
    onRequirementsMet,
    onRequirementsNotMet,
    fallback,
  ]);

  const handleActionPress = useCallback(
    async (requirement: RequirementCheck) => {
      await haptics.light();
      setShowModal(false);

      if (requirement.navigateTo) {
        // Handle navigation based on the destination
        switch (requirement.navigateTo) {
          case 'SignIn':
            navigation.navigate('SignIn');
            break;
          case 'Verification':
            navigation.navigate('Verification', { source: 'requirements' });
            break;
          case 'VerifyPhone':
            navigation.navigate('VerifyPhone', { source: 'requirements' });
            break;
          case 'Subscription':
            navigation.navigate('Subscription');
            break;
          case 'EditProfile':
            navigation.navigate('EditProfile');
            break;
          case 'LegalDocument':
            // Determine which legal document to navigate to
            if (requirement.requirement.toLowerCase().includes('terms')) {
              navigation.navigate('LegalDocument', { documentType: 'terms-of-service' as LegalDocumentType });
            } else if (requirement.requirement.toLowerCase().includes('privacy')) {
              navigation.navigate('LegalDocument', { documentType: 'privacy-policy' as LegalDocumentType });
            } else if (
              requirement.requirement.toLowerCase().includes('companion')
              || requirement.requirement.toLowerCase().includes('wingman')
            ) {
              navigation.navigate('LegalDocument', { documentType: 'companion-agreement' as LegalDocumentType });
            }
            break;
          default:
            break;
        }
      }
    },
    [navigation]
  );

  const handleDismiss = useCallback(async () => {
    await haptics.light();
    setShowModal(false);
    navigation.goBack();
  }, [navigation]);

  // Show loading state
  if (isLoading && showLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.loadingText}>Checking requirements...</Text>
      </View>
    );
  }

  // If all requirements are met, render children
  if (allMet) {
    return <>{children}</>;
  }

  // If fallback is provided and requirements not met, show fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show modal with requirements
  return (
    <>
      {children}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="alert-circle" size={32} color={colors.status.warning} />
              </View>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Text style={styles.modalSubtitle}>
                Please complete the following requirements to continue:
              </Text>
            </View>

            <ScrollView
              style={styles.requirementsList}
              contentContainerStyle={styles.requirementsContent}
              showsVerticalScrollIndicator={false}
            >
              {requirements.map((req, index) => (
                <Card key={index} style={styles.requirementCard}>
                  <View style={styles.requirementContent}>
                    <View style={styles.requirementIcon}>
                      <Ionicons name="close-circle" size={24} color={colors.status.error} />
                    </View>
                    <View style={styles.requirementTextContainer}>
                      <Text style={styles.requirementText}>{req.requirement}</Text>
                    </View>
                  </View>
                  {req.action && (
                    <TouchableOpacity
                      style={styles.requirementAction}
                      onPress={() => handleActionPress(req)}
                    >
                      <Text style={styles.requirementActionText}>{req.action}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.primary.blue} />
                    </TouchableOpacity>
                  )}
                </Card>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Go Back"
                onPress={handleDismiss}
                variant="outline"
                size="large"
                fullWidth
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

/**
 * Hook to check if a feature can be accessed
 * Returns a function that can be called before performing an action
 */
export const useFeatureGate = () => {
  const { canAccessFeature, checkBookingRequirements } = useRequirements();

  const checkFeature = useCallback(
    (feature: AppFeature): { allowed: boolean; reason?: string; navigateTo?: string } => {
      const check = canAccessFeature(feature);
      return {
        allowed: check.met,
        reason: check.requirement,
        navigateTo: check.navigateTo,
      };
    },
    [canAccessFeature]
  );

  const checkBooking = useCallback(() => {
    const reqs = checkBookingRequirements('finalize');
    return {
      allowed: reqs.allMet,
      unmetRequirements: reqs.unmetRequirements,
    };
  }, [checkBookingRequirements]);

  return { checkFeature, checkBooking };
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: spacing.radius.xl,
    borderTopRightRadius: spacing.radius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.status.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  requirementsList: {
    flexGrow: 0,
  },
  requirementsContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  requirementCard: {
    padding: spacing.md,
  },
  requirementContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  requirementIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  requirementTextContainer: {
    flex: 1,
  },
  requirementText: {
    ...typography.presets.body,
    color: colors.text.primary,
  },
  requirementAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.xs,
  },
  requirementActionText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
    fontWeight: typography.weights.medium,
  },
  modalActions: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});

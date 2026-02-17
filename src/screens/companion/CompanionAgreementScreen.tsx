import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, InlineBanner, ScreenScaffold } from '../../components';
import { useTheme } from '../../context/ThemeContext';
import { COMPANION_AGREEMENT } from '../../legal';
import { trackEvent } from '../../services/monitoring/events';
import { acceptWingmanAgreement } from '../../services/api/wingmanOnboardingApi';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRoute = RouteProp<RootStackParamList, 'CompanionAgreement'>;

export const CompanionAgreementScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAcceptEnabled = hasReachedEnd && acknowledged && !isSubmitting;

  const sectionRows = useMemo(() => COMPANION_AGREEMENT.sections, []);

  useEffect(() => {
    trackEvent('wingman_onboarding_step_viewed', { step: 2, source: 'agreement_screen' });
  }, []);

  const handleBack = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (hasReachedEnd) {
      return;
    }

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) {
      setHasReachedEnd(true);
    }
  };

  const handleAccept = async () => {
    if (!isAcceptEnabled) {
      return;
    }

    setIsSubmitting(true);
    await haptics.medium();

    try {
      const { success, error } = await acceptWingmanAgreement(COMPANION_AGREEMENT.version);

      if (!success || error) {
        trackEvent('wingman_agreement_accept_fail', {
          message: error?.message || 'unknown',
        });
        Alert.alert('Unable to accept agreement', error?.message || 'Please try again.');
        return;
      }

      await haptics.success();
      trackEvent('wingman_agreement_accept_success', {
        version: COMPANION_AGREEMENT.version,
      });
      trackEvent('wingman_onboarding_step_completed', { step: 2 });
      Alert.alert(
        'Agreement accepted',
        `Wingman Agreement v${COMPANION_AGREEMENT.version} accepted successfully.`,
        [{
          text: 'Continue',
          onPress: () => {
            if (route.params?.returnToOnboarding && navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            navigation.navigate('CompanionOnboarding');
          },
        }],
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false} style={styles.container}>
      <Header
        title="Wingman Agreement"
        showBack
        onBackPress={handleBack}
        transparent
      />

      <InlineBanner
        title="Step 2 of 3"
        message="Read and acknowledge the full agreement before accepting."
        variant="info"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.metaRow}>
          <Text style={styles.documentTitle}>{COMPANION_AGREEMENT.title}</Text>
          <Text style={styles.documentMeta}>
            Version {COMPANION_AGREEMENT.version} • Updated {COMPANION_AGREEMENT.lastUpdated}
          </Text>
        </View>

        {sectionRows.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.content}</Text>
            {section.subsections?.map((subsection) => (
              <View key={subsection.id} style={styles.subsection}>
                <Text style={styles.subsectionTitle}>{subsection.title}</Text>
                <Text style={styles.sectionBody}>{subsection.content}</Text>
              </View>
            ))}
          </View>
        ))}

        {!hasReachedEnd ? (
          <View style={styles.scrollHint}>
            <Ionicons name="arrow-down-circle" size={18} color={tokens.colors.accent.primary} />
            <Text style={styles.scrollHintText}>Scroll to the end to enable acceptance.</Text>
          </View>
        ) : (
          <View style={styles.scrollHint}>
            <Ionicons name="checkmark-circle" size={18} color={tokens.colors.status.success} />
            <Text style={styles.scrollHintText}>You reached the end of the agreement.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + tokens.spacing.md }]}> 
        <TouchableOpacity
          style={styles.checkboxRow}
          activeOpacity={0.8}
          onPress={() => {
            void haptics.selection();
            setAcknowledged((previous) => !previous);
          }}
        >
          <Ionicons
            name={acknowledged ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={acknowledged ? tokens.colors.accent.primary : tokens.colors.text.tertiary}
          />
          <Text style={styles.checkboxText}>
            I have read and agree to Wingman Agreement v{COMPANION_AGREEMENT.version}.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptButton, !isAcceptEnabled && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={!isAcceptEnabled}
        >
          {isSubmitting ? (
            <ActivityIndicator color={tokens.colors.text.inverse} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={tokens.colors.text.inverse} />
              <Text style={styles.acceptButtonText}>Accept Wingman Agreement</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  metaRow: {
    gap: spacing.xs,
  },
  documentTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  documentMeta: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  subsection: {
    gap: spacing.xs,
    paddingLeft: spacing.md,
  },
  subsectionTitle: {
    ...typography.presets.label,
    color: colors.text.secondary,
  },
  sectionBody: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.surface.level1,
    padding: spacing.md,
  },
  scrollHintText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkboxText: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    flex: 1,
    lineHeight: 20,
  },
  acceptButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.radius.round,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  acceptButtonDisabled: {
    opacity: 0.45,
  },
  acceptButtonText: {
    ...typography.presets.button,
    color: colors.text.inverse,
  },
});

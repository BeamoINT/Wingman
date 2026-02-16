import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Header,
  InlineBanner,
  ScreenScaffold,
  SectionHeader,
  SubscriptionCard,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { trackEvent } from '../services/monitoring/events';
import {
  getEntitlementStatus,
  initRevenueCat,
  purchaseProMonthly,
  restorePurchases,
} from '../services/subscription/revenueCat';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList, Subscription } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PRO_PLAN: Subscription = {
  id: 'pro',
  tier: 'pro',
  price: 10,
  billingPeriod: 'monthly',
  features: [
    { name: 'Unlimited Wingman bookings', description: '', included: true },
    { name: 'Send and receive friend requests', description: '', included: true },
    { name: 'Friend messaging after acceptance', description: '', included: true },
    { name: 'Access feed, groups, and events', description: '', included: true },
  ],
};

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useTheme();
  const { colors, spacing } = tokens;
  const { user, refreshSession } = useAuth();

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isPro = user?.subscriptionTier === 'pro';

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleStartPro = async () => {
    if (!user?.id) {
      Alert.alert('Subscription', 'Please sign in to manage subscriptions.');
      return;
    }

    if (isPro) {
      setStatusMessage('Pro is already active on this account.');
      return;
    }

    setIsPurchasing(true);
    setStatusMessage(null);
    await haptics.medium();
    trackEvent('pro_purchase_started');

    try {
      const initResult = await initRevenueCat(user.id);
      if (!initResult.success) {
        setStatusMessage(initResult.error || 'Unable to initialize subscription purchase.');
        trackEvent('pro_purchase_failed', { reason: initResult.error || 'init_failed' });
        return;
      }

      const purchaseResult = await purchaseProMonthly();
      if (!purchaseResult.success) {
        setStatusMessage(purchaseResult.error || 'Unable to complete Pro purchase right now.');
        trackEvent('pro_purchase_failed', { reason: purchaseResult.error || 'purchase_failed' });
        return;
      }

      const { status } = await getEntitlementStatus();
      if (status.isPro) {
        await refreshSession();
        setStatusMessage('Pro purchase successful. Your access will refresh shortly.');
        trackEvent('pro_purchase_succeeded');
        Alert.alert('Subscription', 'Pro is now active. If this screen still shows Free, reopen the app tab in a moment.');
      } else {
        setStatusMessage('Purchase completed. Final entitlement sync is still in progress.');
        trackEvent('pro_purchase_failed', { reason: 'sync_pending' });
      }
    } catch (error) {
      console.error('Pro purchase flow failed:', error);
      setStatusMessage('Unable to complete your Pro purchase right now.');
      trackEvent('pro_purchase_failed', { reason: 'exception' });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!user?.id) {
      Alert.alert('Subscription', 'Please sign in to restore purchases.');
      return;
    }

    setIsRestoring(true);
    setStatusMessage(null);
    await haptics.light();

    try {
      const initResult = await initRevenueCat(user.id);
      if (!initResult.success) {
        setStatusMessage(initResult.error || 'Unable to initialize purchase restore.');
        trackEvent('pro_restore_failed', { reason: initResult.error || 'init_failed' });
        return;
      }

      const restoreResult = await restorePurchases();
      if (!restoreResult.success) {
        setStatusMessage(restoreResult.error || 'Unable to restore purchases right now.');
        trackEvent('pro_restore_failed', { reason: restoreResult.error || 'restore_failed' });
        return;
      }

      const { status } = await getEntitlementStatus();
      await refreshSession();
      setStatusMessage(status.isPro
        ? 'Pro restored successfully.'
        : 'No active Pro subscription was found to restore.');
      trackEvent(status.isPro ? 'pro_restore_succeeded' : 'pro_restore_failed', {
        reason: status.isPro ? 'restored' : 'not_found',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const currentStatusText = useMemo(() => (
    isPro ? 'Current plan: Pro' : 'Current plan: Free'
  ), [isPro]);

  return (
    <View style={styles.container}>
      <ScreenScaffold scrollable contentContainerStyle={styles.contentContainer} withBottomPadding={false}>
        <Header title="Subscription" showBack onBackPress={handleBackPress} transparent />

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="sparkles" size={26} color={colors.accent.primary} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Wingman Pro</Text>
            <Text style={styles.heroSubtitle}>$10/month. Unlock the full Friends experience.</Text>
            <Text style={styles.heroMeta}>{currentStatusText}</Text>
          </View>
        </View>

        <InlineBanner
          title="Bookings stay free for everyone"
          message="Subscription only affects Friends features. Core Wingman bookings remain free."
          variant="info"
        />

        <View style={styles.section}>
          <SectionHeader title="Plan" subtitle="Single Pro tier, monthly billing only" />
          <View style={styles.planList}>
            <SubscriptionCard
              subscription={PRO_PLAN}
              isSelected
              onSelect={() => undefined}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.restoreLink} onPress={handleRestore} disabled={isRestoring || isPurchasing}>
          <Ionicons name="refresh" size={16} color={colors.primary.blue} />
          <Text style={styles.restoreText}>
            {isRestoring ? 'Restoring purchases...' : 'Restore Purchases'}
          </Text>
        </TouchableOpacity>

        {statusMessage ? (
          <InlineBanner
            title="Subscription Status"
            message={statusMessage}
            variant={statusMessage.toLowerCase().includes('success') ? 'success' : 'info'}
          />
        ) : null}
      </ScreenScaffold>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={isPro
            ? 'Pro Active'
            : (isPurchasing ? 'Starting Pro...' : 'Start Pro')}
          onPress={handleStartPro}
          variant="primary"
          size="large"
          fullWidth
          loading={isPurchasing}
          disabled={isPro}
        />
      </View>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentContainer: {
    gap: spacing.lg,
    paddingBottom: spacing.massive,
  },
  hero: {
    borderRadius: spacing.radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.level1,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  heroTitle: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  heroSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  heroMeta: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  section: {
    gap: spacing.sm,
  },
  planList: {
    gap: spacing.md,
  },
  restoreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  restoreText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useState } from 'react';
import {
    Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Card } from '../components';
import { useAuth } from '../context/AuthContext';
import { checkExistingCompanionProfile, getCompanionApplication } from '../services/api/companionApplicationApi';
import { createPaymentPortalSession } from '../services/api/payments';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { CompanionApplicationStatus, RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'gold' | 'verified' | 'info';
  onPress: () => void | Promise<void>;
}

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [companionStatus, setCompanionStatus] = useState<CompanionApplicationStatus | 'active' | null>(null);
  const [isOpeningPaymentPortal, setIsOpeningPaymentPortal] = useState(false);

  // Load companion/application status on screen focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        // Check if already an active companion
        const { exists } = await checkExistingCompanionProfile();
        if (cancelled) return;
        if (exists) {
          setCompanionStatus('active');
          return;
        }
        // Check for an existing application
        const { application } = await getCompanionApplication();
        if (cancelled) return;
        setCompanionStatus(application?.status || null);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : 'User';

  const handleMenuPress = async (item: MenuItem) => {
    await haptics.light();
    await item.onPress();
  };

  const handleLogout = async () => {
    await haptics.warning();
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              })
            );
          },
        },
      ]
    );
  };

  const handlePaymentMethodsPress = useCallback(async () => {
    if (isOpeningPaymentPortal) {
      return;
    }

    setIsOpeningPaymentPortal(true);
    try {
      const { url, error } = await createPaymentPortalSession();

      if (error || !url) {
        Alert.alert('Payment Methods', error || 'Unable to open payment methods right now.');
        return;
      }

      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        showTitle: true,
      });
    } catch (error) {
      console.error('Error opening payment methods:', error);
      Alert.alert('Payment Methods', 'Unable to open payment methods right now. Please try again.');
    } finally {
      setIsOpeningPaymentPortal(false);
    }
  }, [isOpeningPaymentPortal]);

  const menuItems: MenuItem[] = [
    {
      id: 'subscription',
      icon: 'star',
      label: 'Subscription',
      subtitle: 'Free Plan',
      badge: 'Upgrade',
      badgeVariant: 'gold',
      onPress: () => navigation.navigate('Subscription'),
    },
    {
      id: 'verification',
      icon: 'shield-checkmark',
      label: 'Verification Status',
      subtitle: 'Complete your profile',
      badge: '2/4',
      badgeVariant: 'info',
      onPress: () => navigation.navigate('Verification', { source: 'profile' }),
    },
    {
      id: 'safety',
      icon: 'shield',
      label: 'Safety Center',
      subtitle: 'Emergency contacts & settings',
      onPress: () => navigation.navigate('Safety'),
    },
    {
      id: 'payments',
      icon: 'card',
      label: 'Payment Methods',
      subtitle: isOpeningPaymentPortal ? 'Opening Stripe payment portal...' : 'Manage your payment options',
      onPress: handlePaymentMethodsPress,
    },
    {
      id: 'settings',
      icon: 'settings',
      label: 'Settings',
      subtitle: 'Notifications, privacy & more',
      onPress: () => navigation.navigate('Settings'),
    },
    {
      id: 'help',
      icon: 'help-circle',
      label: 'Help & Support',
      subtitle: 'FAQs and contact us',
      onPress: () => {},
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Profile Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={async () => {
            await haptics.light();
            // Navigate to edit profile
          }}
        >
          <Card variant="gradient" style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Avatar
                source={user?.avatar}
                name={fullName}
                size="large"
                showVerified={user?.isVerified}
                verificationLevel={user?.isVerified ? 'verified' : 'basic'}
              />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{fullName}</Text>
                <Text style={styles.profileEmail}>{user?.email || ''}</Text>
                <View style={styles.profileBadges}>
                  {user?.isVerified && (
                    <Badge label="Verified" variant="verified" icon="checkmark-circle" size="small" />
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        {/* Become a Wingman / Wingman Status Banner */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={async () => {
            await haptics.medium();
            if (companionStatus === 'active' || companionStatus === 'approved') {
              navigation.navigate('CompanionDashboard');
            } else if (companionStatus === 'pending_review' || companionStatus === 'under_review' || companionStatus === 'suspended') {
              navigation.navigate('CompanionApplicationStatus');
            } else if (companionStatus === 'draft') {
              navigation.navigate('CompanionOnboarding');
            } else {
              // No application yet — start onboarding
              navigation.navigate('CompanionOnboarding');
            }
          }}
        >
          <LinearGradient
            colors={colors.gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.companionBanner}
          >
            <View style={styles.companionIcon}>
              <Ionicons
                name={
                  companionStatus === 'active' || companionStatus === 'approved'
                    ? 'grid'
                    : companionStatus === 'pending_review' || companionStatus === 'under_review'
                    ? 'time'
                    : 'people'
                }
                size={24}
                color={colors.primary.darkBlack}
              />
            </View>
            <View style={styles.companionContent}>
              <Text style={styles.companionTitle}>
                {companionStatus === 'active' || companionStatus === 'approved'
                  ? 'Wingman Dashboard'
                  : companionStatus === 'pending_review' || companionStatus === 'under_review'
                  ? 'Application Under Review'
                  : companionStatus === 'draft'
                  ? 'Continue Application'
                  : 'Become a Wingman'}
              </Text>
              <Text style={styles.companionSubtitle}>
                {companionStatus === 'active' || companionStatus === 'approved'
                  ? 'Manage your Wingman profile'
                  : companionStatus === 'pending_review' || companionStatus === 'under_review'
                  ? 'Check your application status'
                  : companionStatus === 'draft'
                  ? 'Pick up where you left off'
                  : 'Earn money by being a great friend'}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.primary.darkBlack} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => handleMenuPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name={item.icon} size={22} color={colors.primary.blue} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.subtitle && (
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                )}
              </View>
              {item.badge && (
                <Badge
                  label={item.badge}
                  variant={item.badgeVariant || 'info'}
                  size="small"
                />
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.status.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Wingman v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.presets.h1,
    color: colors.text.primary,
  },
  profileCard: {
    marginBottom: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  profileEmail: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    paddingVertical: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  companionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: spacing.radius.xl,
    marginBottom: spacing.xl,
  },
  companionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  companionContent: {
    flex: 1,
  },
  companionTitle: {
    ...typography.presets.h4,
    color: colors.primary.darkBlack,
  },
  companionSubtitle: {
    ...typography.presets.caption,
    color: colors.primary.darkBlack,
    opacity: 0.8,
    marginTop: 2,
  },
  menuSection: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
  },
  menuSubtitle: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.status.errorLight,
    borderRadius: spacing.radius.lg,
    marginBottom: spacing.lg,
  },
  logoutText: {
    ...typography.presets.button,
    color: colors.status.error,
  },
  version: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});

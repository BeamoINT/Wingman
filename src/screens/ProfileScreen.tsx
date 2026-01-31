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
import { Avatar, Badge, Card } from '../components';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'gold' | 'verified' | 'info';
  onPress: () => void;
}

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const handleMenuPress = async (item: MenuItem) => {
    await haptics.light();
    item.onPress();
  };

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
      onPress: () => navigation.navigate('Verification'),
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
      subtitle: 'Manage your payment options',
      onPress: () => {},
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
          onPress={() => {
            haptics.light();
            // Navigate to edit profile
          }}
        >
          <Card variant="gradient" style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Avatar
                source="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400"
                name="Alex Thompson"
                size="large"
                showVerified
                verificationLevel="verified"
              />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Alex Thompson</Text>
                <Text style={styles.profileEmail}>alex@example.com</Text>
                <View style={styles.profileBadges}>
                  <Badge label="Verified" variant="verified" icon="checkmark-circle" size="small" />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>12</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>4.8</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>8</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        {/* Become a Companion */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => haptics.medium()}>
          <LinearGradient
            colors={colors.gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.companionBanner}
          >
            <View style={styles.companionIcon}>
              <Ionicons name="people" size={24} color={colors.primary.darkBlack} />
            </View>
            <View style={styles.companionContent}>
              <Text style={styles.companionTitle}>Become a Companion</Text>
              <Text style={styles.companionSubtitle}>
                Earn money by being a great friend
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
          onPress={() => haptics.warning()}
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

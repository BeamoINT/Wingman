import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  type: 'toggle' | 'link' | 'value';
  value?: string | boolean;
  onPress?: () => void;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();

  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleToggle = async (
    value: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    await haptics.selection();
    setter(value);
  };

  const cycleThemeMode = async () => {
    await haptics.selection();

    if (themeMode === 'system') {
      await setThemeMode('light');
      return;
    }

    if (themeMode === 'light') {
      await setThemeMode('dark');
      return;
    }

    await setThemeMode('system');
  };

  const appearanceValue = themeMode === 'system'
    ? `System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
    : themeMode === 'dark'
      ? 'Dark'
      : 'Light';

  const settingSections: SettingSection[] = [
    {
      title: 'Account & Security',
      items: [
        {
          id: 'change-email',
          icon: 'mail',
          label: 'Change Email',
          type: 'value',
          value: user?.email || '',
          onPress: () => navigation.navigate('ChangeEmail'),
        },
        {
          id: 'change-password',
          icon: 'lock-closed',
          label: 'Change Password',
          type: 'link',
          onPress: () => navigation.navigate('ChangePassword'),
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          id: 'push',
          icon: 'notifications',
          label: 'Push Notifications',
          type: 'toggle',
          value: notifications,
        },
        {
          id: 'email',
          icon: 'mail',
          label: 'Email Updates',
          type: 'toggle',
          value: emailUpdates,
        },
      ],
    },
    {
      title: 'Privacy',
      items: [
        {
          id: 'location',
          icon: 'location',
          label: 'Location Services',
          type: 'toggle',
          value: locationServices,
        },
        {
          id: 'visibility',
          icon: 'eye',
          label: 'Profile Visibility',
          type: 'value',
          value: 'Everyone',
        },
        {
          id: 'blocked',
          icon: 'ban',
          label: 'Blocked Users',
          type: 'link',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          id: 'haptic',
          icon: 'phone-portrait',
          label: 'Haptic Feedback',
          type: 'toggle',
          value: hapticFeedback,
        },
        {
          id: 'appearance',
          icon: 'color-palette',
          label: 'Appearance',
          type: 'value',
          value: appearanceValue,
          onPress: cycleThemeMode,
        },
        {
          id: 'language',
          icon: 'globe',
          label: 'Language',
          type: 'value',
          value: 'English',
        },
        {
          id: 'currency',
          icon: 'cash',
          label: 'Currency',
          type: 'value',
          value: 'USD ($)',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          icon: 'help-circle',
          label: 'Help Center',
          type: 'link',
        },
        {
          id: 'report',
          icon: 'flag',
          label: 'Report a Problem',
          type: 'link',
        },
        {
          id: 'feedback',
          icon: 'chatbox',
          label: 'Send Feedback',
          type: 'link',
        },
      ],
    },
    {
      title: 'Legal',
      items: [
        {
          id: 'terms',
          icon: 'document-text',
          label: 'Terms of Service',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'terms-of-service' }),
        },
        {
          id: 'privacy',
          icon: 'shield-checkmark',
          label: 'Privacy Policy',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'privacy-policy' }),
        },
        {
          id: 'community',
          icon: 'people',
          label: 'Community Guidelines',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'community-guidelines' }),
        },
        {
          id: 'refund',
          icon: 'card',
          label: 'Refund Policy',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'refund-policy' }),
        },
        {
          id: 'safety',
          icon: 'warning',
          label: 'Safety Disclaimer',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'safety-disclaimer' }),
        },
        {
          id: 'cookies',
          icon: 'analytics',
          label: 'Cookie Policy',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'cookie-policy' }),
        },
        {
          id: 'acceptable-use',
          icon: 'checkmark-circle',
          label: 'Acceptable Use Policy',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'acceptable-use' }),
        },
        {
          id: 'copyright',
          icon: 'copy',
          label: 'DMCA & Copyright Policy',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'copyright-policy' }),
        },
        {
          id: 'california',
          icon: 'location',
          label: 'California Privacy Notice',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'california-privacy' }),
        },
        {
          id: 'esign',
          icon: 'create',
          label: 'Electronic Signature Consent',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'electronic-signature' }),
        },
      ],
    },
  ];

  const getToggleSetter = (id: string) => {
    switch (id) {
      case 'push':
        return setNotifications;
      case 'email':
        return setEmailUpdates;
      case 'location':
        return setLocationServices;
      case 'haptic':
        return setHapticFeedback;
      default:
        return () => {};
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {settingSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            <Card variant="outlined" style={styles.sectionCard}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.settingRow,
                    index < section.items.length - 1 && styles.settingRowBorder,
                  ]}
                  onPress={() => {
                    if (item.type !== 'toggle') {
                      haptics.light();
                      item.onPress?.();
                    }
                  }}
                  activeOpacity={item.type === 'toggle' ? 1 : 0.7}
                >
                  <View style={styles.settingIcon}>
                    <Ionicons name={item.icon} size={20} color={colors.primary.blue} />
                  </View>

                  <Text style={styles.settingLabel}>{item.label}</Text>

                  {item.type === 'toggle' && (
                    <Switch
                      value={item.value as boolean}
                      onValueChange={(v) => handleToggle(v, getToggleSetter(item.id))}
                      trackColor={{ false: colors.background.tertiary, true: colors.primary.blue }}
                      thumbColor={colors.text.primary}
                    />
                  )}

                  {item.type === 'value' && (
                    <View style={styles.valueContainer}>
                      <Text style={styles.valueText}>{item.value as string}</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
                    </View>
                  )}

                  {item.type === 'link' && (
                    <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
                  )}
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        ))}

        {/* Account Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => haptics.warning()}
          >
            <Ionicons name="trash-outline" size={20} color={colors.status.error} />
            <Text style={styles.dangerText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>Wingman</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.copyright}>© 2026 Beamo LLC</Text>
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
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.label,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  sectionCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
    flex: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  valueText: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.status.errorLight,
    borderRadius: spacing.radius.lg,
  },
  dangerText: {
    ...typography.presets.button,
    color: colors.status.error,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  appName: {
    ...typography.presets.h4,
    color: colors.text.tertiary,
  },
  appVersion: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  copyright: {
    ...typography.presets.caption,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
});

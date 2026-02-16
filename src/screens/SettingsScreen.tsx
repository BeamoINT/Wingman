import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  Card,
  Header,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type AppearanceModeOption = 'light' | 'dark' | 'system';

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

const APPEARANCE_OPTIONS: Array<{ id: AppearanceModeOption; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { tokens, themeMode, resolvedTheme, setThemeMode } = useTheme();
  const { colors, spacing, typography } = tokens;

  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  const styles = useThemedStyles((themeTokens) => StyleSheet.create({
    content: {
      gap: themeTokens.spacing.lg,
    },
    section: {
      gap: themeTokens.spacing.sm,
    },
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: themeTokens.spacing.sm,
      gap: themeTokens.spacing.md,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: themeTokens.colors.border.subtle,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: themeTokens.spacing.sm,
      flex: 1,
    },
    iconShell: {
      width: 32,
      height: 32,
      borderRadius: themeTokens.spacing.radius.sm,
      backgroundColor: themeTokens.colors.surface.level2,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...themeTokens.typography.presets.bodyMedium,
      color: themeTokens.colors.text.primary,
      flexShrink: 1,
    },
    value: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.secondary,
      textAlign: 'right',
      maxWidth: 180,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: themeTokens.spacing.xs,
      marginLeft: themeTokens.spacing.sm,
    },
    appearanceCard: {
      borderColor: themeTokens.colors.accent.primary,
      backgroundColor: themeTokens.colors.surface.level1,
    },
    appearanceText: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.secondary,
      marginTop: themeTokens.spacing.xxs,
      marginBottom: themeTokens.spacing.sm,
    },
    segmentTrack: {
      flexDirection: 'row',
      backgroundColor: themeTokens.colors.surface.level2,
      borderRadius: themeTokens.spacing.radius.md,
      padding: 4,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.light,
    },
    segment: {
      flex: 1,
      minHeight: 38,
      borderRadius: themeTokens.spacing.radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: themeTokens.colors.surface.level0,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.light,
    },
    segmentText: {
      ...themeTokens.typography.presets.buttonSmall,
      color: themeTokens.colors.text.secondary,
    },
    segmentTextActive: {
      color: themeTokens.colors.text.primary,
    },
    helper: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.tertiary,
      marginTop: themeTokens.spacing.xs,
    },
  }));

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

  const handleChangeThemeMode = async (mode: AppearanceModeOption) => {
    if (mode === themeMode) {
      return;
    }

    await haptics.selection();
    await setThemeMode(mode);
  };

  const appearanceLabel = themeMode === 'system'
    ? `Following system (${resolvedTheme})`
    : `Using ${themeMode} mode`;

  const settingSections: SettingSection[] = useMemo(() => [
    {
      title: 'Account',
      items: [
        {
          id: 'change-email',
          icon: 'mail-outline',
          label: 'Change Email',
          type: 'value',
          value: user?.email || '',
          onPress: () => navigation.navigate('ChangeEmail'),
        },
        {
          id: 'change-password',
          icon: 'lock-closed-outline',
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
          icon: 'notifications-outline',
          label: 'Push Notifications',
          type: 'toggle',
          value: notifications,
        },
        {
          id: 'email',
          icon: 'mail-outline',
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
          icon: 'location-outline',
          label: 'Location Services',
          type: 'toggle',
          value: locationServices,
        },
        {
          id: 'blocked',
          icon: 'ban-outline',
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
          icon: 'phone-portrait-outline',
          label: 'Haptic Feedback',
          type: 'toggle',
          value: hapticFeedback,
        },
        {
          id: 'language',
          icon: 'globe-outline',
          label: 'Language',
          type: 'value',
          value: 'English',
        },
        {
          id: 'currency',
          icon: 'cash-outline',
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
          icon: 'help-circle-outline',
          label: 'Help Center',
          type: 'link',
        },
        {
          id: 'report',
          icon: 'flag-outline',
          label: 'Report a Problem',
          type: 'link',
        },
      ],
    },
    {
      title: 'Legal',
      items: [
        {
          id: 'terms',
          icon: 'document-text-outline',
          label: 'Terms of Service',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'terms-of-service' }),
        },
        {
          id: 'privacy',
          icon: 'shield-checkmark-outline',
          label: 'Privacy Policy',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'privacy-policy' }),
        },
        {
          id: 'community',
          icon: 'people-outline',
          label: 'Community Guidelines',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'community-guidelines' }),
        },
        {
          id: 'refund',
          icon: 'card-outline',
          label: 'Refund Policy',
          type: 'link',
          onPress: () => navigation.navigate('LegalDocument', { documentType: 'refund-policy' }),
        },
      ],
    },
  ], [
    emailUpdates,
    hapticFeedback,
    locationServices,
    navigation,
    notifications,
    user?.email,
  ]);

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
    <ScreenScaffold scrollable withBottomPadding contentContainerStyle={styles.content}>
      <Header title="Settings" showBack onBackPress={handleBackPress} />

      <Card variant="outlined" style={styles.appearanceCard}>
        <SectionHeader title="Appearance" subtitle="Choose your preferred look" />
        <Text style={styles.appearanceText}>{appearanceLabel}</Text>
        <View style={styles.segmentTrack}>
          {APPEARANCE_OPTIONS.map((option) => {
            const isActive = themeMode === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.segment, isActive && styles.segmentActive]}
                onPress={() => {
                  void handleChangeThemeMode(option.id);
                }}
              >
                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helper}>
          Light and Dark apply instantly. System follows your device setting.
        </Text>
      </Card>

      {settingSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <SectionHeader title={section.title} />
          <Card variant="outlined" padding="small">
            {section.items.map((item, index) => {
              const isLast = index === section.items.length - 1;
              const toggleSetter = getToggleSetter(item.id);
              const value = item.value;
              const isToggle = item.type === 'toggle';
              const isLink = item.type === 'link';
              const rowPressable = Boolean(item.onPress) || isToggle;

              return (
                <Pressable
                  key={item.id}
                  disabled={!rowPressable}
                  onPress={() => {
                    if (item.onPress) {
                      void haptics.light().then(item.onPress);
                      return;
                    }
                    if (isToggle) {
                      void handleToggle(!(value as boolean), toggleSetter);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    !isLast && styles.rowBorder,
                    pressed && rowPressable
                      ? { backgroundColor: colors.interactive.pressed }
                      : null,
                  ]}
                >
                  <View style={styles.left}>
                    <View style={styles.iconShell}>
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={isLink ? colors.accent.primary : colors.text.secondary}
                      />
                    </View>
                    <Text style={styles.label}>{item.label}</Text>
                  </View>

                  <View style={styles.right}>
                    {item.type === 'value' ? (
                      <Text numberOfLines={1} style={styles.value}>
                        {String(item.value || '')}
                      </Text>
                    ) : null}

                    {isToggle ? (
                      <Switch
                        value={item.value === true}
                        onValueChange={(next) => {
                          void handleToggle(next, toggleSetter);
                        }}
                        thumbColor={item.value === true ? colors.accent.primary : colors.surface.level3}
                        trackColor={{
                          false: colors.border.light,
                          true: colors.accent.soft,
                        }}
                      />
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.text.tertiary}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
    </ScreenScaffold>
  );
};

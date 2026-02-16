import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Header,
  InlineBanner,
  SafetyBanner,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const emergencyContacts = [
  { id: '1', name: 'Mom', phone: '+1 (555) 123-4567', isPrimary: true },
  { id: '2', name: 'Best Friend', phone: '+1 (555) 987-6543', isPrimary: false },
];

interface SafetySettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const SafetySettingRow: React.FC<SafetySettingRowProps> = ({
  icon,
  title,
  description,
  value,
  onChange,
}) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={18} color={colors.accent.primary} />
      </View>

      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: colors.background.tertiary,
          true: colors.accent.primary,
        }}
        thumbColor={colors.text.inverse}
      />
    </View>
  );
};

export const SafetyScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  const [shareLocation, setShareLocation] = useState(true);
  const [safetyCheckins, setSafetyCheckins] = useState(true);
  const [emergencyButton, setEmergencyButton] = useState(true);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleToggle = async (
    value: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    await haptics.selection();
    setter(value);
  };

  return (
    <ScreenScaffold scrollable contentContainerStyle={styles.contentContainer}>
      <Header
        title="Safety Center"
        showBack
        onBackPress={handleBackPress}
        transparent
      />

      <InlineBanner
        title="Every Wingman is ID and photo verified before bookings"
        message="Safety checks are active before, during, and after every session."
        variant="info"
      />

      <View style={styles.section}>
        <SectionHeader
          title="Emergency"
          subtitle="Fast access if something feels wrong"
        />
        <SafetyBanner variant="emergency" onPress={() => haptics.heavy()} />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Safety Features"
          subtitle="Control live protections for your bookings"
        />

        <Card variant="outlined" style={styles.settingsCard}>
          <SafetySettingRow
            icon="location"
            title="Share Live Location"
            description="Automatically share your location with emergency contacts during bookings."
            value={shareLocation}
            onChange={(value) => handleToggle(value, setShareLocation)}
          />
          <View style={styles.divider} />
          <SafetySettingRow
            icon="notifications"
            title="Safety Check-ins"
            description="Receive periodic check-in prompts while your booking is active."
            value={safetyCheckins}
            onChange={(value) => handleToggle(value, setSafetyCheckins)}
          />
          <View style={styles.divider} />
          <SafetySettingRow
            icon="alert-circle"
            title="Emergency Button"
            description="Show a one-tap emergency trigger during sessions."
            value={emergencyButton}
            onChange={(value) => handleToggle(value, setEmergencyButton)}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Emergency Contacts"
          subtitle="Trusted people to notify quickly"
          actionLabel="Add"
          onPressAction={() => haptics.light()}
        />

        {emergencyContacts.map((contact) => (
          <Card key={contact.id} variant="outlined" style={styles.contactCard}>
            <View style={styles.contactRow}>
              <Avatar name={contact.name} size="small" />

              <View style={styles.contactInfo}>
                <View style={styles.contactHeader}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  {contact.isPrimary ? (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryText}>Primary</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>

              <TouchableOpacity onPress={() => haptics.light()}>
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="How Safety Works"
          subtitle="Protection through the full booking lifecycle"
        />

        <Card variant="gradient" style={styles.timelineCard}>
          {[
            {
              title: 'Before Your Booking',
              description:
                'Your emergency contacts can receive booking context and readiness alerts.',
            },
            {
              title: 'During Your Booking',
              description:
                'Location sharing and check-ins help detect interruptions quickly.',
            },
            {
              title: 'If Something Goes Wrong',
              description:
                'Use emergency actions to alert contacts and Wingman support immediately.',
            },
          ].map((item, index) => (
            <View key={item.title} style={styles.timelineRow}>
              <View style={styles.timelineIndex}>
                <Text style={styles.timelineIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{item.title}</Text>
                <Text style={styles.timelineDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      <Card variant="outlined" style={styles.supportCard}>
        <View style={styles.supportIcon}>
          <Ionicons name="headset" size={24} color={colors.accent.primary} />
        </View>
        <Text style={styles.supportTitle}>24/7 Safety Support</Text>
        <Text style={styles.supportDescription}>
          Our trust and safety team is available around the clock to assist you.
        </Text>
        <Button
          title="Contact Support"
          onPress={() => haptics.light()}
          variant="outline"
          size="medium"
          style={styles.supportButton}
        />
      </Card>

      <TouchableOpacity style={styles.reportButton} onPress={() => haptics.light()}>
        <Ionicons name="flag-outline" size={18} color={colors.status.error} />
        <Text style={styles.reportText}>Report a Safety Concern</Text>
      </TouchableOpacity>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  contentContainer: {
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  settingsCard: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
    gap: spacing.xs,
  },
  settingTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  settingDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  contactCard: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  contactInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contactName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  contactPhone: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  primaryBadge: {
    backgroundColor: colors.status.successLight,
    borderRadius: spacing.radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  primaryText: {
    ...typography.presets.caption,
    color: colors.status.success,
  },
  timelineCard: {
    gap: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  timelineIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.primary,
    marginTop: 2,
  },
  timelineIndexText: {
    ...typography.presets.caption,
    color: colors.text.inverse,
    fontWeight: typography.weights.bold,
  },
  timelineContent: {
    flex: 1,
    gap: spacing.xs,
  },
  timelineTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  timelineDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  supportCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  supportIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.blueSoft,
  },
  supportTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    textAlign: 'center',
  },
  supportDescription: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 420,
  },
  supportButton: {
    marginTop: spacing.xs,
    minWidth: 200,
  },
  reportButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.status.error,
    backgroundColor: colors.status.errorLight,
  },
  reportText: {
    ...typography.presets.buttonSmall,
    color: colors.status.error,
  },
});

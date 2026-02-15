import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Card, SafetyBanner } from '../components';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const emergencyContacts = [
  { id: '1', name: 'Mom', phone: '+1 (555) 123-4567', isPrimary: true },
  { id: '2', name: 'Best Friend', phone: '+1 (555) 987-6543', isPrimary: false },
];

export const SafetyScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [shareLocation, setShareLocation] = useState(true);
  const [safetyCheckins, setSafetyCheckins] = useState(true);
  const [emergencyButton, setEmergencyButton] = useState(true);

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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety Center</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Emergency SOS */}
        <View style={styles.section}>
          <SafetyBanner variant="emergency" onPress={() => haptics.heavy()} />
        </View>

        {/* Safety Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Features</Text>

          <Card variant="outlined" style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Ionicons name="location" size={20} color={colors.primary.blue} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Share Live Location</Text>
                <Text style={styles.settingDescription}>
                  Automatically share your location with emergency contacts during bookings
                </Text>
              </View>
              <Switch
                value={shareLocation}
                onValueChange={(v) => handleToggle(v, setShareLocation)}
                trackColor={{ false: colors.background.tertiary, true: colors.primary.blue }}
                thumbColor={colors.text.primary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Ionicons name="notifications" size={20} color={colors.primary.blue} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Safety Check-ins</Text>
                <Text style={styles.settingDescription}>
                  Receive periodic check-in prompts during bookings
                </Text>
              </View>
              <Switch
                value={safetyCheckins}
                onValueChange={(v) => handleToggle(v, setSafetyCheckins)}
                trackColor={{ false: colors.background.tertiary, true: colors.primary.blue }}
                thumbColor={colors.text.primary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Ionicons name="alert-circle" size={20} color={colors.primary.blue} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Emergency Button</Text>
                <Text style={styles.settingDescription}>
                  Show quick access emergency button during bookings
                </Text>
              </View>
              <Switch
                value={emergencyButton}
                onValueChange={(v) => handleToggle(v, setEmergencyButton)}
                trackColor={{ false: colors.background.tertiary, true: colors.primary.blue }}
                thumbColor={colors.text.primary}
              />
            </View>
          </Card>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <TouchableOpacity onPress={() => haptics.light()}>
              <Text style={styles.addText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {emergencyContacts.map((contact) => (
            <Card key={contact.id} variant="outlined" style={styles.contactCard}>
              <View style={styles.contactRow}>
                <Avatar name={contact.name} size="small" />
                <View style={styles.contactInfo}>
                  <View style={styles.contactHeader}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryText}>Primary</Text>
                      </View>
                    )}
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

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Safety Works</Text>

          <Card variant="gradient" style={styles.howItWorksCard}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Before Your Booking</Text>
                <Text style={styles.stepDescription}>
                  Share your plans with emergency contacts. They'll receive your booking details.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>During Your Booking</Text>
                <Text style={styles.stepDescription}>
                  Your live location is shared. You'll receive check-in prompts every 30 minutes.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>If Something Goes Wrong</Text>
                <Text style={styles.stepDescription}>
                  Tap the emergency button to alert contacts and our support team instantly.
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Trust & Safety Team */}
        <View style={styles.section}>
          <Card variant="outlined" style={styles.supportCard}>
            <View style={styles.supportIcon}>
              <Ionicons name="headset" size={28} color={colors.primary.blue} />
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
        </View>

        {/* Report */}
        <TouchableOpacity style={styles.reportButton} onPress={() => haptics.light()}>
          <Ionicons name="flag-outline" size={20} color={colors.status.error} />
          <Text style={styles.reportText}>Report a Safety Concern</Text>
        </TouchableOpacity>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  addText: {
    ...typography.presets.button,
    color: colors.primary.blue,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  settingDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 4,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginLeft: spacing.lg + 40 + spacing.md,
  },
  contactCard: {
    marginBottom: spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  primaryBadge: {
    backgroundColor: colors.primary.blueGlow,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.radius.sm,
  },
  primaryText: {
    ...typography.presets.caption,
    color: colors.primary.blue,
    fontSize: 10,
  },
  contactPhone: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  howItWorksCard: {
    gap: spacing.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepNumberText: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    marginBottom: 4,
  },
  stepDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  supportCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  supportIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  supportTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  supportDescription: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  supportButton: {
    minWidth: 160,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.xl,
  },
  reportText: {
    ...typography.presets.button,
    color: colors.status.error,
  },
});

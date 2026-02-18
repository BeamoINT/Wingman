import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Header,
  Input,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import {
  deleteEmergencyContact,
  listEmergencyContacts,
  sendEmergencyContactOtp,
  type EmergencyContactRecord,
  upsertEmergencyContact,
  verifyEmergencyContactOtp,
} from '../services/api/emergencyContactsApi';
import { trackEvent } from '../services/monitoring/events';
import type { RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

const emptyForm = {
  name: '',
  phone: '',
  relationship: '',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const EmergencyContactsScreen: React.FC = () => {
  const { tokens } = useTheme();
  const { colors } = tokens;
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NavigationProp>();

  const [contacts, setContacts] = useState<EmergencyContactRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [otpContactId, setOtpContactId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    const { contacts: nextContacts, error } = await listEmergencyContacts();
    setIsLoading(false);

    if (error) {
      Alert.alert('Unable to load contacts', error.message);
      return;
    }

    setContacts(nextContacts);
  }, []);

  React.useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const editingContact = useMemo(() => {
    if (!editingContactId) {
      return null;
    }

    return contacts.find((contact) => contact.id === editingContactId) || null;
  }, [contacts, editingContactId]);

  const onPressEdit = useCallback((contact: EmergencyContactRecord) => {
    setEditingContactId(contact.id);
    setForm({
      name: contact.name,
      phone: contact.phone_e164,
      relationship: contact.relationship,
    });
    setOtpContactId(null);
    setOtpCode('');
  }, []);

  const resetForm = useCallback(() => {
    setEditingContactId(null);
    setForm(emptyForm);
    setOtpContactId(null);
    setOtpCode('');
  }, []);

  const onPressSave = useCallback(async () => {
    setIsSaving(true);

    const { contact, error } = await upsertEmergencyContact({
      contactId: editingContactId || undefined,
      name: form.name,
      phone: form.phone,
      relationship: form.relationship,
    });

    setIsSaving(false);

    if (error || !contact) {
      Alert.alert('Unable to save contact', error?.message || 'Please try again.');
      return;
    }

    Alert.alert('Saved', editingContactId ? 'Emergency contact updated.' : 'Emergency contact added.');
    if (!editingContactId) {
      trackEvent('emergency_contact_added');
    }
    resetForm();
    await loadContacts();
  }, [editingContactId, form.name, form.phone, form.relationship, loadContacts, resetForm]);

  const onPressDelete = useCallback((contact: EmergencyContactRecord) => {
    Alert.alert(
      'Remove Contact',
      `Remove ${contact.name} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { success, error } = await deleteEmergencyContact(contact.id);
            if (!success || error) {
              Alert.alert('Unable to remove contact', error?.message || 'Please try again.');
              return;
            }

            if (otpContactId === contact.id) {
              setOtpContactId(null);
              setOtpCode('');
            }

            trackEvent('emergency_contact_removed');
            await loadContacts();
          },
        },
      ],
    );
  }, [loadContacts, otpContactId]);

  const onSendOtp = useCallback(async (contact: EmergencyContactRecord) => {
    setIsOtpSending(true);
    const { success, alreadyVerified, error } = await sendEmergencyContactOtp(contact.id);
    setIsOtpSending(false);

    if (!success && !alreadyVerified) {
      Alert.alert('Unable to send code', error?.message || 'Please try again.');
      return;
    }

    if (alreadyVerified) {
      Alert.alert('Already verified', `${contact.name} is already verified.`);
      await loadContacts();
      return;
    }

    setOtpContactId(contact.id);
    setOtpCode('');
    Alert.alert('Code sent', `A verification code was sent to ${contact.phone_e164}.`);
  }, [loadContacts]);

  const onVerifyOtp = useCallback(async () => {
    if (!otpContactId || !otpCode.trim()) {
      Alert.alert('Code required', 'Enter the verification code first.');
      return;
    }

    setIsOtpVerifying(true);
    const { verified, error } = await verifyEmergencyContactOtp(otpContactId, otpCode.trim());
    setIsOtpVerifying(false);

    if (!verified || error) {
      Alert.alert('Verification failed', error?.message || 'Check the code and try again.');
      return;
    }

    Alert.alert('Verified', 'Emergency contact phone number verified.');
    trackEvent('emergency_contact_verified');
    setOtpCode('');
    setOtpContactId(null);
    await loadContacts();
  }, [otpCode, otpContactId, loadContacts]);

  const canSave = !!form.name.trim() && !!form.phone.trim() && !!form.relationship.trim();

  return (
    <ScreenScaffold scrollable contentContainerStyle={styles.contentContainer}>
      <Header title="Emergency Contacts" showBack onBackPress={() => navigation.goBack()} />

      <SectionHeader
        title="Your Contacts"
        subtitle="Only verified contacts can receive SOS alerts and live location"
      />

      <Card variant="outlined" style={styles.listCard}>
        {isLoading ? (
          <Text style={styles.loadingText}>Loading contacts...</Text>
        ) : contacts.length === 0 ? (
          <Text style={styles.emptyText}>No emergency contacts added yet.</Text>
        ) : (
          contacts.map((contact, index) => (
            <View key={contact.id} style={[styles.contactRow, index !== contacts.length - 1 && styles.rowDivider]}>
              <View style={styles.contactMeta}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactDetail}>{contact.relationship} • {contact.phone_e164}</Text>
                <View style={styles.verificationRow}>
                  <Ionicons
                    name={contact.is_verified ? 'checkmark-circle' : 'alert-circle'}
                    size={14}
                    color={contact.is_verified ? colors.status.success : colors.status.warning}
                  />
                  <Text style={styles.verificationText}>
                    {contact.is_verified ? 'Verified' : 'Phone not verified'}
                  </Text>
                </View>
              </View>

              <View style={styles.contactActions}>
                <TouchableOpacity onPress={() => onPressEdit(contact)} style={styles.actionButton}>
                  <Ionicons name="create-outline" size={18} color={colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onPressDelete(contact)} style={styles.actionButton}>
                  <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                </TouchableOpacity>
              </View>

              {!contact.is_verified && (
                <View style={styles.verifyActions}>
                  <Button
                    title="Send OTP"
                    variant="outline"
                    size="small"
                    onPress={() => onSendOtp(contact)}
                    loading={isOtpSending && otpContactId === contact.id}
                  />

                  {otpContactId === contact.id && (
                    <View style={styles.otpRow}>
                      <Input
                        value={otpCode}
                        onChangeText={setOtpCode}
                        placeholder="Enter code"
                        keyboardType="number-pad"
                        containerStyle={styles.otpInput}
                      />
                      <Button
                        title="Verify"
                        variant="primary"
                        size="small"
                        onPress={onVerifyOtp}
                        loading={isOtpVerifying}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </Card>

      <SectionHeader
        title={editingContact ? 'Edit Contact' : 'Add Contact'}
        subtitle="Name, phone number, and relationship are required"
      />

      <Card variant="outlined" style={styles.formCard}>
        <Input
          label="Name"
          value={form.name}
          onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
          autoCapitalize="words"
          placeholder="Jane Doe"
        />

        <Input
          label="Phone"
          value={form.phone}
          onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
          keyboardType="phone-pad"
          placeholder="+1 555 123 4567"
        />

        <Input
          label="Relationship"
          value={form.relationship}
          onChangeText={(value) => setForm((prev) => ({ ...prev, relationship: value }))}
          placeholder="Sibling, parent, friend"
        />

        <View style={styles.formActions}>
          {editingContact ? (
            <Button
              title="Cancel"
              variant="ghost"
              size="small"
              onPress={resetForm}
            />
          ) : null}

          <Button
            title={editingContact ? 'Save Changes' : 'Add Contact'}
            variant="primary"
            size="small"
            onPress={onPressSave}
            disabled={!canSave}
            loading={isSaving}
          />
        </View>
      </Card>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  contentContainer: {
    gap: spacing.lg,
  },
  listCard: {
    gap: spacing.md,
  },
  loadingText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  emptyText: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  contactRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: spacing.sm,
  },
  contactMeta: {
    gap: spacing.xs,
  },
  contactName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  contactDetail: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  verificationText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  actionButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.radius.sm,
    backgroundColor: colors.surface.level1,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  verifyActions: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  otpInput: {
    flex: 1,
    marginBottom: 0,
  },
  formCard: {
    gap: spacing.sm,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

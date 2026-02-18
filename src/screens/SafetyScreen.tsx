import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Header,
  InlineBanner,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { useSafetyAudio } from '../context/SafetyAudioContext';
import { useSafety } from '../context/SafetyContext';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList } from '../types';

const HOLD_DURATION_MS = 1500;
const CHECKIN_INTERVAL_OPTIONS = [15, 30, 45, 60];
const RESPONSE_WINDOW_OPTIONS = [5, 10, 15];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function resolveEmergencyDialNumber(countryName?: string): string {
  const normalized = String(countryName || '').trim().toLowerCase();

  if (normalized.includes('united kingdom') || normalized.includes('ireland')) {
    return '999';
  }

  if (normalized.includes('australia')) {
    return '000';
  }

  if (normalized.includes('new zealand')) {
    return '111';
  }

  if (
    normalized.includes('germany')
    || normalized.includes('france')
    || normalized.includes('spain')
    || normalized.includes('italy')
    || normalized.includes('portugal')
    || normalized.includes('sweden')
    || normalized.includes('norway')
    || normalized.includes('denmark')
  ) {
    return '112';
  }

  return '911';
}

function formatElapsedDuration(elapsedMs: number): string {
  const safeMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

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

  const { user } = useAuth();
  const {
    contacts,
    preferences,
    sessions,
    pendingCheckin,
    hasActiveSafetySession,
    hasAcknowledgedSafetyDisclaimer,
    isLoading,
    updatePreferences,
    acknowledgeSafetyDisclaimer,
    respondCheckin,
    triggerSos,
    refreshSafetyState,
  } = useSafety();
  const {
    isRecording: isSafetyAudioRecording,
    isTransitioning: isSafetyAudioTransitioning,
    recordingState: safetyAudioRecordingState,
    elapsedMs: safetyAudioElapsedMs,
    autoRecordDefaultEnabled,
    setAutoRecordDefaultEnabled,
    startRecording: startSafetyAudioRecording,
    stopRecording: stopSafetyAudioRecording,
    storageStatus: safetyAudioStorageStatus,
  } = useSafetyAudio();

  const [sosHolding, setSosHolding] = useState(false);
  const [sosProgress, setSosProgress] = useState(0);
  const [sosBusy, setSosBusy] = useState(false);
  const [isAcknowledgingDisclaimer, setIsAcknowledgingDisclaimer] = useState(false);
  const holdStartRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [emergencyDialNumber, setEmergencyDialNumber] = useState(
    resolveEmergencyDialNumber(user?.location?.country),
  );

  const safetyAudioStateLabel = useMemo(() => {
    if (safetyAudioRecordingState === 'recording') {
      return 'Recording';
    }
    if (safetyAudioRecordingState === 'paused') {
      return 'Paused';
    }
    if (safetyAudioRecordingState === 'interrupted') {
      return 'Interrupted';
    }
    if (safetyAudioRecordingState === 'starting') {
      return 'Starting';
    }
    if (safetyAudioRecordingState === 'stopping') {
      return 'Stopping';
    }
    return 'Stopped';
  }, [safetyAudioRecordingState]);

  const verifiedContacts = useMemo(
    () => contacts.filter((contact) => contact.is_verified),
    [contacts],
  );

  const cleanupHoldState = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }

    holdStartRef.current = null;
    setSosHolding(false);
    setSosProgress(0);
  }, []);

  const getCurrentLocationSnapshot = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        const requested = await Location.requestForegroundPermissionsAsync();
        if (requested.status !== Location.PermissionStatus.GRANTED) {
          return null;
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const accuracyM = typeof location.coords.accuracy === 'number'
        && Number.isFinite(location.coords.accuracy)
        ? location.coords.accuracy
        : undefined;

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracyM,
        capturedAt: new Date(location.timestamp).toISOString(),
      };
    } catch {
      return null;
    }
  }, []);

  const executeSosTrigger = useCallback(async () => {
    if (sosBusy) {
      return;
    }

    setSosBusy(true);
    const location = await getCurrentLocationSnapshot();

    const activeSession = sessions.find((session) => session.status === 'active') || null;

    const {
      success,
      sentCount,
      failedCount,
      emergencyDialNumber: resolvedDial,
      error,
    } = await triggerSos({
      bookingId: activeSession?.booking_id || undefined,
      location: location || undefined,
      includeLiveLocationLink: false,
      source: 'sos_button',
    });

    setSosBusy(false);

    if (resolvedDial) {
      setEmergencyDialNumber(resolvedDial);
    }

    if (!success) {
      Alert.alert(
        'SOS Alert Failed',
        error || 'Unable to alert emergency contacts right now. Call emergency services directly.',
      );
      return;
    }

    Alert.alert(
      'SOS Sent',
      `Alert sent to ${sentCount} contact${sentCount === 1 ? '' : 's'}${failedCount > 0 ? ` (${failedCount} failed)` : ''}.`,
    );
  }, [getCurrentLocationSnapshot, sessions, sosBusy, triggerSos]);

  const startSosHold = useCallback(() => {
    if (sosBusy) {
      return;
    }

    setSosHolding(true);
    setSosProgress(0);
    holdStartRef.current = Date.now();

    holdTimeoutRef.current = setTimeout(() => {
      cleanupHoldState();
      void executeSosTrigger();
    }, HOLD_DURATION_MS);

    holdIntervalRef.current = setInterval(() => {
      if (!holdStartRef.current) {
        return;
      }

      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(1, elapsed / HOLD_DURATION_MS);
      setSosProgress(progress);
    }, 50);
  }, [cleanupHoldState, executeSosTrigger, sosBusy]);

  const onToggleSafetySetting = useCallback(async (
    nextValue: boolean,
    key: 'checkinsEnabled' | 'autoShareLiveLocation' | 'sosEnabled' | 'autoRecordSafetyAudioOnVisit',
  ) => {
    const result = await updatePreferences({ [key]: nextValue });
    if (!result.success) {
      Alert.alert('Unable to save setting', result.error || 'Please try again.');
    }
  }, [updatePreferences]);

  const onToggleSafetyAudioDefault = useCallback(async (nextValue: boolean) => {
    const result = await setAutoRecordDefaultEnabled(nextValue);
    if (!result.success) {
      Alert.alert('Unable to save setting', result.error || 'Please try again.');
    }
  }, [setAutoRecordDefaultEnabled]);

  const onToggleSafetyAudioNow = useCallback(async (nextValue: boolean) => {
    if (isSafetyAudioTransitioning) {
      return;
    }

    if (nextValue) {
      const result = await startSafetyAudioRecording();
      if (!result.success) {
        Alert.alert('Unable to start recording', result.error || 'Please try again.');
      }
      return;
    }

    await stopSafetyAudioRecording('safety-screen-toggle');
  }, [isSafetyAudioTransitioning, startSafetyAudioRecording, stopSafetyAudioRecording]);

  const onSelectCheckinInterval = useCallback(async (minutes: number) => {
    const result = await updatePreferences({ checkinIntervalMinutes: minutes });
    if (!result.success) {
      Alert.alert('Unable to save setting', result.error || 'Please try again.');
    }
  }, [updatePreferences]);

  const onSelectResponseWindow = useCallback(async (minutes: number) => {
    const result = await updatePreferences({ checkinResponseWindowMinutes: minutes });
    if (!result.success) {
      Alert.alert('Unable to save setting', result.error || 'Please try again.');
    }
  }, [updatePreferences]);

  const onPressCallEmergency = useCallback(async () => {
    const phoneToDial = emergencyDialNumber || resolveEmergencyDialNumber(user?.location?.country);
    const telUrl = `tel:${phoneToDial}`;

    const supported = await Linking.canOpenURL(telUrl);
    if (!supported) {
      Alert.alert('Unable to place call', `Please call ${phoneToDial} from your phone dialer.`);
      return;
    }

    await Linking.openURL(telUrl);
  }, [emergencyDialNumber, user?.location?.country]);

  const onRespondPendingCheckin = useCallback(async (response: 'safe' | 'unsafe') => {
    if (!pendingCheckin?.pending_checkin_id) {
      return;
    }

    const result = await respondCheckin(pendingCheckin.pending_checkin_id, response);
    if (!result.success) {
      Alert.alert('Unable to submit response', result.error || 'Please try again.');
      return;
    }

    if (response === 'unsafe') {
      const activeSession = sessions.find((session) => session.status === 'active') || null;
      const location = await getCurrentLocationSnapshot();
      await triggerSos({
        bookingId: activeSession?.booking_id || undefined,
        source: 'checkin_unsafe',
        includeLiveLocationLink: false,
        location: location || undefined,
      });
    }

    await refreshSafetyState();
  }, [getCurrentLocationSnapshot, pendingCheckin?.pending_checkin_id, refreshSafetyState, respondCheckin, sessions, triggerSos]);

  const onAcknowledgeSafetyDisclaimer = useCallback(async () => {
    if (isAcknowledgingDisclaimer) {
      return;
    }

    setIsAcknowledgingDisclaimer(true);
    const result = await acknowledgeSafetyDisclaimer();
    setIsAcknowledgingDisclaimer(false);

    if (!result.success) {
      Alert.alert('Unable to save acknowledgement', result.error || 'Please try again.');
      return;
    }

    Alert.alert('Acknowledged', 'Emergency safety terms have been recorded for your account.');
  }, [acknowledgeSafetyDisclaimer, isAcknowledgingDisclaimer]);

  return (
    <ScreenScaffold scrollable contentContainerStyle={styles.contentContainer}>
      <Header
        title="Safety Center"
        showBack
        onBackPress={() => navigation.goBack()}
        transparent
      />

      <InlineBanner
        title="Emergency protection is active"
        message="SOS sends real SMS alerts to your verified emergency contacts."
        variant="info"
      />

      {!hasAcknowledgedSafetyDisclaimer ? (
        <Card variant="outlined" style={styles.acknowledgementCard}>
          <Text style={styles.acknowledgementTitle}>Safety Terms Required</Text>
          <Text style={styles.acknowledgementBody}>
            Confirm you understand SOS is for real emergencies only and does not replace calling emergency services.
          </Text>
          <Button
            title={isAcknowledgingDisclaimer ? 'Saving...' : 'Acknowledge Safety Terms'}
            variant="primary"
            size="small"
            loading={isAcknowledgingDisclaimer}
            onPress={() => { void onAcknowledgeSafetyDisclaimer(); }}
          />
        </Card>
      ) : null}

      {pendingCheckin?.pending_checkin_id ? (
        <Card variant="outlined" style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>Safety Check-in</Text>
          <Text style={styles.pendingDescription}>Everything okay right now?</Text>
          <View style={styles.pendingActions}>
            <Button
              title="I'm Safe"
              variant="outline"
              size="small"
              onPress={() => { void onRespondPendingCheckin('safe'); }}
            />
            <Button
              title="Not Safe"
              variant="danger"
              size="small"
              onPress={() => { void onRespondPendingCheckin('unsafe'); }}
            />
          </View>
        </Card>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Emergency SOS"
          subtitle="Press and hold to prevent accidental activation"
        />

        <Card variant="outlined" style={styles.sosCard}>
          <Pressable
            onPressIn={startSosHold}
            onPressOut={cleanupHoldState}
            disabled={sosBusy || verifiedContacts.length === 0 || !hasAcknowledgedSafetyDisclaimer}
            style={({ pressed }) => [
              styles.sosButton,
              (pressed || sosHolding) && styles.sosButtonPressed,
              (sosBusy || verifiedContacts.length === 0 || !hasAcknowledgedSafetyDisclaimer) && styles.sosButtonDisabled,
            ]}
          >
            <Ionicons name="warning" size={22} color={colors.text.onDanger} />
            <Text style={styles.sosButtonText}>
              {!hasAcknowledgedSafetyDisclaimer
                ? 'Acknowledge safety terms first'
                : verifiedContacts.length === 0
                ? 'Add and verify a contact first'
                : sosBusy
                  ? 'Sending SOS...'
                  : 'Hold 1.5s to Send SOS'}
            </Text>
          </Pressable>

          <View style={styles.sosProgressTrack}>
            <View style={[styles.sosProgressFill, { width: `${Math.round(sosProgress * 100)}%` }]} />
          </View>

          <Button
            title={`Call Emergency Services (${emergencyDialNumber})`}
            variant="outline"
            size="small"
            onPress={() => { void onPressCallEmergency(); }}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Safety Features"
          subtitle="Persistent settings for your account"
        />

        <Card variant="outlined" style={styles.settingsCard}>
          <SafetySettingRow
            icon="location"
            title="Auto Share emergency location"
            description="When enabled, you can quickly share live location with emergency contacts during bookings."
            value={preferences?.auto_share_live_location ?? false}
            onChange={(value) => { void onToggleSafetySetting(value, 'autoShareLiveLocation'); }}
          />
          <View style={styles.divider} />
          <SafetySettingRow
            icon="mic"
            title="Auto Record safety audio on visits"
            description="Store local-only safety audio automatically when active booking or live-location sessions begin."
            value={autoRecordDefaultEnabled}
            onChange={(value) => { void onToggleSafetyAudioDefault(value); }}
          />
          <View style={styles.divider} />
          <SafetySettingRow
            icon="notifications"
            title="Safety check-ins"
            description="Receive periodic safety prompts during active bookings."
            value={preferences?.checkins_enabled ?? true}
            onChange={(value) => { void onToggleSafetySetting(value, 'checkinsEnabled'); }}
          />
          <View style={styles.divider} />
          <SafetySettingRow
            icon="alert-circle"
            title="Enable SOS trigger"
            description="Keep hold-to-confirm SOS action available."
            value={preferences?.sos_enabled ?? true}
            onChange={(value) => { void onToggleSafetySetting(value, 'sosEnabled'); }}
          />
        </Card>

        <Card variant="outlined" style={styles.audioCard}>
          <View style={styles.audioCardHeader}>
            <View style={styles.audioStatusMeta}>
              <Text style={styles.timingTitle}>Safety Audio Recording</Text>
              <Text style={styles.timingSubtitle}>
                Local only. Never uploaded. Auto-deletes after 7 days.
              </Text>
            </View>
            <View style={[
              styles.audioStateBadge,
              safetyAudioRecordingState === 'recording' && styles.audioStateBadgeRecording,
              safetyAudioRecordingState === 'paused' && styles.audioStateBadgePaused,
              safetyAudioRecordingState === 'interrupted' && styles.audioStateBadgeInterrupted,
            ]}
            >
              <Text style={styles.audioStateText}>{safetyAudioStateLabel}</Text>
            </View>
          </View>

          <View style={styles.audioLiveRow}>
            <View style={styles.audioTimerWrap}>
              <Ionicons name="timer-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.audioTimerText}>{formatElapsedDuration(safetyAudioElapsedMs)}</Text>
            </View>
            <Switch
              value={isSafetyAudioRecording}
              onValueChange={(value) => { void onToggleSafetyAudioNow(value); }}
              disabled={isSafetyAudioTransitioning || safetyAudioStorageStatus.critical}
              trackColor={{ false: colors.background.tertiary, true: colors.accent.primary }}
              thumbColor={colors.text.inverse}
            />
          </View>

          <Text style={styles.bookingSafetyHelper}>
            {isSafetyAudioTransitioning
              ? 'Applying change...'
              : isSafetyAudioRecording
                ? 'Recording is active and will continue in background on supported builds.'
                : 'Recording is currently off.'}
          </Text>

          <Button
            title={isSafetyAudioRecording ? 'Stop Recording' : 'Start Recording'}
            variant={isSafetyAudioRecording ? 'danger' : 'primary'}
            size="small"
            disabled={isSafetyAudioTransitioning || safetyAudioStorageStatus.critical}
            onPress={() => { void onToggleSafetyAudioNow(!isSafetyAudioRecording); }}
          />

          {safetyAudioStorageStatus.critical ? (
            <Text style={styles.audioCriticalText}>
              Recording is blocked because storage is critically low on this device.
            </Text>
          ) : null}
          {safetyAudioStorageStatus.warning && !safetyAudioStorageStatus.critical ? (
            <Text style={styles.audioWarningText}>
              Storage is running low. Consider deleting old local recordings soon.
            </Text>
          ) : null}
          <Button
            title="Manage Local Recordings"
            variant="outline"
            size="small"
            onPress={() => navigation.navigate('SafetyAudioRecordings')}
          />
        </Card>

        <Card variant="outlined" style={styles.timingCard}>
          <Text style={styles.timingTitle}>Check-in Interval</Text>
          <Text style={styles.timingSubtitle}>
            How often Wingman asks if you are safe during active bookings.
          </Text>
          <View style={styles.optionRow}>
            {CHECKIN_INTERVAL_OPTIONS.map((minutes) => {
              const selected = (preferences?.checkin_interval_minutes || 30) === minutes;
              return (
                <Pressable
                  key={`interval-${minutes}`}
                  onPress={() => { void onSelectCheckinInterval(minutes); }}
                  style={[styles.optionPill, selected && styles.optionPillSelected]}
                >
                  <Text style={[styles.optionPillText, selected && styles.optionPillTextSelected]}>
                    {minutes}m
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.timingTitle}>Response Window</Text>
          <Text style={styles.timingSubtitle}>
            How long Wingman waits before escalating if you do not respond.
          </Text>
          <View style={styles.optionRow}>
            {RESPONSE_WINDOW_OPTIONS.map((minutes) => {
              const selected = (preferences?.checkin_response_window_minutes || 10) === minutes;
              return (
                <Pressable
                  key={`window-${minutes}`}
                  onPress={() => { void onSelectResponseWindow(minutes); }}
                  style={[styles.optionPill, selected && styles.optionPillSelected]}
                >
                  <Text style={[styles.optionPillText, selected && styles.optionPillTextSelected]}>
                    {minutes}m
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Emergency Contacts"
          subtitle={`${verifiedContacts.length} verified of ${contacts.length} total`}
          actionLabel="Manage"
          onPressAction={() => navigation.navigate('EmergencyContacts')}
        />

        <Card variant="outlined" style={styles.contactsCard}>
          {isLoading ? (
            <Text style={styles.loadingText}>Loading contacts...</Text>
          ) : contacts.length === 0 ? (
            <Text style={styles.emptyText}>Add emergency contacts so SOS can alert someone immediately.</Text>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactRow}>
                <View style={styles.contactMeta}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactDetail}>{contact.relationship} • {contact.phone_e164}</Text>
                </View>
                <View style={styles.contactStatus}>
                  <Ionicons
                    name={contact.is_verified ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={contact.is_verified ? colors.status.success : colors.status.warning}
                  />
                  <Text style={styles.contactStatusText}>{contact.is_verified ? 'Verified' : 'Unverified'}</Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </View>

      {hasActiveSafetySession ? (
        <InlineBanner
          title="Active booking safety monitoring"
          message="SOS and check-ins are actively monitoring your booking session."
          variant="info"
        />
      ) : null}
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
  acknowledgementCard: {
    gap: spacing.sm,
    borderColor: colors.status.warning,
    backgroundColor: colors.status.warningLight,
  },
  acknowledgementTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  acknowledgementBody: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  pendingCard: {
    gap: spacing.sm,
    borderColor: colors.status.warning,
    backgroundColor: colors.status.warningLight,
  },
  pendingTitle: {
    ...typography.presets.body,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  pendingDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sosCard: {
    gap: spacing.sm,
    borderColor: colors.status.error,
  },
  sosButton: {
    minHeight: 56,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  sosButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  sosButtonDisabled: {
    opacity: 0.55,
  },
  sosButtonText: {
    ...typography.presets.body,
    color: colors.text.onDanger,
    fontWeight: typography.weights.semibold,
  },
  sosProgressTrack: {
    height: 6,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.status.errorLight,
    overflow: 'hidden',
  },
  sosProgressFill: {
    height: '100%',
    backgroundColor: colors.status.error,
  },
  settingsCard: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  timingCard: {
    gap: spacing.sm,
  },
  audioCard: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  audioCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  audioStatusMeta: {
    flex: 1,
    gap: spacing.xxs,
  },
  audioStateBadge: {
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  audioStateBadgeRecording: {
    borderColor: colors.status.warning,
    backgroundColor: colors.status.warningLight,
  },
  audioStateBadgePaused: {
    borderColor: colors.status.warning,
    backgroundColor: colors.status.warningLight,
  },
  audioStateBadgeInterrupted: {
    borderColor: colors.status.error,
    backgroundColor: colors.status.errorLight,
  },
  audioStateText: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  audioLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  audioTimerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  audioTimerText: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  bookingSafetyHelper: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  audioWarningText: {
    ...typography.presets.caption,
    color: colors.status.warning,
  },
  audioCriticalText: {
    ...typography.presets.caption,
    color: colors.status.error,
  },
  timingTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  timingSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  optionPill: {
    minWidth: 56,
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  optionPillSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.primary.blueSoft,
  },
  optionPillText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    fontWeight: typography.weights.semibold,
  },
  optionPillTextSelected: {
    color: colors.accent.primary,
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
    backgroundColor: colors.accent.soft,
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
  contactsCard: {
    gap: spacing.sm,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  contactMeta: {
    flex: 1,
    gap: spacing.xxs,
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
  contactStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contactStatusText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
});

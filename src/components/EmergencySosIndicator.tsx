import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafety } from '../context/SafetyContext';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

export const EmergencySosIndicator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasActiveSafetySession, hasAcknowledgedSafetyDisclaimer, sessions, triggerSos } = useSafety();

  if (!hasActiveSafetySession || !hasAcknowledgedSafetyDisclaimer) {
    return null;
  }

  const activeSession = sessions.find((session) => session.status === 'active') || null;

  const onTrigger = () => {
    Alert.alert(
      'Send SOS Alert?',
      'This immediately sends emergency SMS alerts to your verified emergency contacts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            const permission = await Location.getForegroundPermissionsAsync();
            let locationPayload: {
              latitude?: number;
              longitude?: number;
              accuracyM?: number;
              capturedAt?: string;
            } | undefined;

            if (permission.status === Location.PermissionStatus.GRANTED) {
              try {
                const location = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                const accuracyM = typeof location.coords.accuracy === 'number'
                  && Number.isFinite(location.coords.accuracy)
                  ? location.coords.accuracy
                  : undefined;

                locationPayload = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  accuracyM,
                  capturedAt: new Date(location.timestamp).toISOString(),
                };
              } catch {
                locationPayload = undefined;
              }
            }

            const { success, sentCount, failedCount, error } = await triggerSos({
              bookingId: activeSession?.booking_id || undefined,
              location: locationPayload,
              source: 'sos_button',
            });

            if (!success) {
              Alert.alert('Unable to send SOS', error || 'Please try again.');
              return;
            }

            Alert.alert('SOS Sent', `Alert sent to ${sentCount} contact${sentCount === 1 ? '' : 's'}${failedCount > 0 ? ` (${failedCount} failed)` : ''}.`);
          },
        },
      ],
    );
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.container, { marginTop: insets.top + tokens.spacing.xxl }]}> 
        <TouchableOpacity style={styles.button} onPress={onTrigger}>
          <Ionicons name="warning" size={14} color={tokens.colors.text.onDanger} />
          <Text style={styles.buttonText}>Emergency SOS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 998,
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  container: {
    width: '100%',
    maxWidth: spacing.contentMaxWidthWide,
    alignItems: 'flex-end',
  },
  button: {
    minHeight: 36,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.status.error,
    backgroundColor: colors.status.error,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  buttonText: {
    ...typography.presets.caption,
    color: colors.text.onDanger,
    fontWeight: typography.weights.semibold,
  },
});

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafetyAudio } from '../context/SafetyAudioContext';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

function formatSessionDuration(startedAt: string): string {
  const startedAtMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedAtMs)) {
    return 'active now';
  }

  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - startedAtMs) / 60_000));
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m elapsed`;
  }

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m elapsed`;
}

export const SafetyAudioRecordingIndicator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    isRecording,
    isTransitioning,
    activeSession,
    stopRecording,
  } = useSafetyAudio();

  const helperText = useMemo(() => {
    if (!activeSession?.startedAt) {
      return 'local only';
    }
    return `${formatSessionDuration(activeSession.startedAt)} • local only`;
  }, [activeSession?.startedAt]);

  if (!isRecording) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.container, { marginTop: insets.top + tokens.spacing.huge }]}>
        <View style={styles.leftContent}>
          <Ionicons name="mic" size={14} color={tokens.colors.status.warning} />
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>
              Safety audio recording
            </Text>
            <Text style={styles.helper} numberOfLines={1}>
              {helperText}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.stopButton}
          onPress={() => {
            void stopRecording('indicator-stop');
          }}
          disabled={isTransitioning}
        >
          {isTransitioning ? (
            <ActivityIndicator size="small" color={tokens.colors.status.error} />
          ) : (
            <>
              <Ionicons name="stop-circle-outline" size={14} color={tokens.colors.status.error} />
              <Text style={styles.stopText}>Stop</Text>
            </>
          )}
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
    zIndex: 997,
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  container: {
    width: '100%',
    maxWidth: spacing.contentMaxWidthWide,
    minHeight: 44,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.status.warning,
    backgroundColor: colors.surface.level0,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  helper: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: 1,
  },
  stopButton: {
    minHeight: 30,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.status.error,
    backgroundColor: colors.surface.level1,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stopText: {
    ...typography.presets.caption,
    color: colors.status.error,
  },
});


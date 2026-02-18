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

function formatElapsedDuration(elapsedMs: number): string {
  const safeMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const SafetyAudioRecordingIndicator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    isTransitioning,
    recordingState,
    elapsedMs,
    activeSession,
    stopRecording,
  } = useSafetyAudio();

  const stateLabel = useMemo(() => {
    if (recordingState === 'recording') {
      return 'Recording';
    }
    if (recordingState === 'paused') {
      return 'Paused';
    }
    if (recordingState === 'interrupted') {
      return 'Interrupted';
    }
    if (recordingState === 'starting') {
      return 'Starting';
    }
    if (recordingState === 'stopping') {
      return 'Stopping';
    }
    return 'Stopped';
  }, [recordingState]);

  const helperText = useMemo(() => {
    if (recordingState === 'interrupted' && activeSession?.lastInterruptionReason) {
      return `${formatElapsedDuration(elapsedMs)} • interrupted • local only`;
    }

    if (recordingState === 'paused') {
      return `${formatElapsedDuration(elapsedMs)} • paused • local only`;
    }

    return `${formatElapsedDuration(elapsedMs)} • local only`;
  }, [activeSession?.lastInterruptionReason, elapsedMs, recordingState]);

  const stateColor = useMemo(() => {
    if (recordingState === 'recording') {
      return tokens.colors.status.warning;
    }
    if (recordingState === 'interrupted') {
      return tokens.colors.status.error;
    }
    if (recordingState === 'paused') {
      return tokens.colors.status.warning;
    }
    if (recordingState === 'starting') {
      return tokens.colors.accent.primary;
    }
    return tokens.colors.text.secondary;
  }, [recordingState, tokens.colors.accent.primary, tokens.colors.status.error, tokens.colors.status.warning, tokens.colors.text.secondary]);

  if (!activeSession || recordingState === 'stopped') {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.container, { marginTop: insets.top + tokens.spacing.huge }]}>
        <View style={styles.leftContent}>
          <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                Safety Audio
              </Text>
              <View style={[styles.stateBadge, { borderColor: stateColor }]}>
                <Text style={[styles.stateText, { color: stateColor }]}>{stateLabel}</Text>
              </View>
            </View>
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
              <Ionicons name="stop-circle-outline" size={15} color={tokens.colors.status.error} />
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
    minHeight: 54,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    shadowColor: colors.shadow.light,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  stateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  stateBadge: {
    borderWidth: 1,
    borderRadius: spacing.radius.round,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  stateText: {
    ...typography.presets.caption,
    fontWeight: typography.weights.semibold,
  },
  helper: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  stopButton: {
    minHeight: 32,
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
    fontWeight: typography.weights.semibold,
  },
});

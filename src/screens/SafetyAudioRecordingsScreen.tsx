import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AVPlaybackStatus } from 'expo-av';
import {
  Card,
  Header,
  InlineBanner,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { useSafetyAudio } from '../context/SafetyAudioContext';
import { useTheme } from '../context/ThemeContext';
import {
  createSafetyAudioPlayback,
  playSafetyAudio,
  stopSafetyAudio,
  unloadSafetyAudio,
} from '../services/safety-audio/safetyAudioRecorder';
import { removeSafetyAudioRecording } from '../services/safety-audio/safetyAudioStorage';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList, SafetyAudioRecording } from '../types';
import { trackEvent } from '../services/monitoring/events';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 MB';
  }
  const mb = value / (1024 * 1024);
  if (mb < 1) {
    const kb = value / 1024;
    return `${Math.max(1, Math.round(kb))} KB`;
  }
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFreeStorage(freeBytes: number | null): string {
  if (typeof freeBytes !== 'number') {
    return 'Unavailable';
  }
  const gb = freeBytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB free`;
  }
  return `${(freeBytes / (1024 * 1024)).toFixed(0)} MB free`;
}

export const SafetyAudioRecordingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useTheme();
  const {
    recordings,
    refreshRecordings,
    storageStatus,
    recordingState,
    elapsedMs,
    isCloudUploadProEnabled,
    hasCloudReadAccess,
    cloudSync,
  } = useSafetyAudio();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Awaited<ReturnType<typeof createSafetyAudioPlayback>> | null>(null);

  useEffect(() => {
    void refreshRecordings();
  }, [refreshRecordings]);

  useEffect(() => {
    return () => {
      void unloadSafetyAudio(soundRef.current);
      soundRef.current = null;
    };
  }, []);

  const handlePlayToggle = useCallback(async (recording: SafetyAudioRecording) => {
    if (playingId === recording.id && soundRef.current) {
      await stopSafetyAudio(soundRef.current);
      await unloadSafetyAudio(soundRef.current);
      soundRef.current = null;
      setPlayingId(null);
      return;
    }

    if (soundRef.current) {
      await stopSafetyAudio(soundRef.current);
      await unloadSafetyAudio(soundRef.current);
      soundRef.current = null;
    }

    const sound = await createSafetyAudioPlayback(recording.uri);
    soundRef.current = sound;
    setPlayingId(recording.id);

    await playSafetyAudio(sound, (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        return;
      }

      if (status.didJustFinish) {
        void unloadSafetyAudio(sound);
        soundRef.current = null;
        setPlayingId(null);
      }
    });
  }, [playingId]);

  const handleDelete = useCallback((recording: SafetyAudioRecording) => {
    Alert.alert(
      'Delete Recording?',
      'This removes the audio file from your device immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (playingId === recording.id && soundRef.current) {
                await stopSafetyAudio(soundRef.current);
                await unloadSafetyAudio(soundRef.current);
                soundRef.current = null;
                setPlayingId(null);
              }

              await removeSafetyAudioRecording(recording.id, { deleteFile: true });
              await refreshRecordings();
              trackEvent('safety_audio_deleted', { source: 'manual' });
            })();
          },
        },
      ],
    );
  }, [playingId, refreshRecordings]);

  return (
    <ScreenScaffold scrollable contentContainerStyle={styles.content}>
      <Header
        title="Safety Audio"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <InlineBanner
        title="Local only recording"
        message={isCloudUploadProEnabled
          ? 'Local files auto-delete after 7 days. Pro cloud upload is enabled separately with a 3-month retention maximum.'
          : 'Safety audio files stay on this device and auto-delete after 7 days. Cloud storage is available with Wingman Pro.'}
        variant="info"
      />

      {hasCloudReadAccess ? (
        <Card variant="outlined" style={styles.cloudEntryCard}>
          <SectionHeader
            title="Cloud Safety Audio"
            subtitle={isCloudUploadProEnabled
              ? (cloudSync.state === 'uploading'
                ? `Uploading ${Math.round(cloudSync.activeUploadProgress * 100)}%`
                : `${cloudSync.queueCount} upload${cloudSync.queueCount === 1 ? '' : 's'} queued`)
              : 'Read-only grace mode'}
            actionLabel="Open"
            onPressAction={() => navigation.navigate('CloudSafetyAudioRecordings')}
          />
          <Text style={styles.storageText}>
            {isCloudUploadProEnabled
              ? 'Stream, download, and delete your private cloud recordings.'
              : 'Grace access is active. Download or delete cloud files before grace ends.'}
          </Text>
        </Card>
      ) : null}

      <Card variant="outlined" style={styles.liveStateCard}>
        <View style={styles.liveStateRow}>
          <View style={styles.liveStateBadge}>
            <Ionicons name="radio-outline" size={14} color={tokens.colors.accent.primary} />
            <Text style={styles.liveStateLabel}>
              {recordingState === 'recording'
                ? 'Recording active'
                : recordingState === 'paused'
                  ? 'Recording paused'
                  : recordingState === 'interrupted'
                    ? 'Recording interrupted'
                    : recordingState === 'starting'
                      ? 'Recording starting'
                      : 'Recording stopped'}
            </Text>
          </View>
          <Text style={styles.liveStateTimer}>{formatDuration(elapsedMs)}</Text>
        </View>
      </Card>

      <Card variant="outlined" style={styles.storageCard}>
        <SectionHeader title="Storage Health" />
        <Text style={styles.storageText}>{formatFreeStorage(storageStatus.freeBytes)}</Text>
        {storageStatus.critical ? (
          <Text style={styles.storageCritical}>
            Storage is critically low. New safety recordings are blocked until space is available.
          </Text>
        ) : null}
        {!storageStatus.critical && storageStatus.warning ? (
          <Text style={styles.storageWarning}>
            Storage is low. Consider deleting old recordings soon.
          </Text>
        ) : null}
      </Card>

      <Card variant="outlined" style={styles.listCard}>
        <SectionHeader
          title="Local Recordings"
          subtitle={`${recordings.length} saved`}
          actionLabel="Refresh"
          onPressAction={() => {
            void refreshRecordings();
          }}
        />

        {recordings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mic-off-outline" size={20} color={tokens.colors.text.tertiary} />
            <Text style={styles.emptyStateText}>
              No local safety recordings yet.
            </Text>
          </View>
        ) : (
          <FlatList
            data={recordings}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            renderItem={({ item }) => (
              <View style={styles.recordingRow}>
                <View style={styles.recordingMeta}>
                  <Text style={styles.recordingTitle}>{formatDateTime(item.createdAt)}</Text>
                  <Text style={styles.recordingSubtitle}>
                    {formatDuration(item.durationMs)} • {formatBytes(item.sizeBytes)}
                  </Text>
                  <Text style={styles.recordingSubtitle}>
                    Expires {formatDateTime(item.expiresAt)}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      void handlePlayToggle(item);
                    }}
                  >
                    <Ionicons
                      name={playingId === item.id ? 'stop-circle-outline' : 'play-circle-outline'}
                      size={18}
                      color={tokens.colors.accent.primary}
                    />
                    <Text style={styles.actionText}>{playingId === item.id ? 'Stop' : 'Play'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(item)}
                  >
                    <Ionicons name="trash-outline" size={18} color={tokens.colors.status.error} />
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </Card>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  liveStateCard: {
    gap: spacing.xs,
  },
  liveStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  liveStateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    backgroundColor: colors.primary.blueSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  liveStateLabel: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  liveStateTimer: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  storageCard: {
    gap: spacing.xs,
  },
  cloudEntryCard: {
    gap: spacing.xs,
  },
  storageText: {
    ...typography.presets.body,
    color: colors.text.primary,
  },
  storageWarning: {
    ...typography.presets.caption,
    color: colors.status.warning,
  },
  storageCritical: {
    ...typography.presets.caption,
    color: colors.status.error,
  },
  listCard: {
    gap: spacing.sm,
  },
  emptyState: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyStateText: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recordingMeta: {
    flex: 1,
    gap: spacing.xxs,
  },
  recordingTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  recordingSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    minHeight: 34,
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...typography.presets.caption,
    color: colors.text.primary,
  },
  deleteButton: {
    borderColor: colors.status.error,
  },
  deleteText: {
    ...typography.presets.caption,
    color: colors.status.error,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
  },
});

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
import * as FileSystem from 'expo-file-system/legacy';
import type { AVPlaybackStatus } from 'expo-av';
import {
  Card,
  Header,
  InlineBanner,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { useSafetyAudio } from '../context/SafetyAudioContext';
import {
  deleteSafetyAudioCloudRecording,
  downloadSafetyAudioCloudRecordingToLocalFile,
  getSafetyAudioDownloadUrl,
  listMySafetyAudioCloudRecordings,
  type SafetyAudioCloudRecording,
} from '../services/api/safetyAudioCloudApi';
import {
  createSafetyAudioPlayback,
  playSafetyAudio,
  stopSafetyAudio,
  unloadSafetyAudio,
} from '../services/safety-audio/safetyAudioRecorder';
import {
  ensureSafetyAudioRootDirectory,
  persistSafetyAudioSegmentFromTemp,
} from '../services/safety-audio/safetyAudioStorage';
import { trackEvent } from '../services/monitoring/events';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatBytes(value: number | null): string {
  if (!value || value <= 0) {
    return '0 MB';
  }

  const mb = value / (1024 * 1024);
  if (mb < 1) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(ms / 1000);
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

export const CloudSafetyAudioRecordingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    isCloudUploadProEnabled,
    hasCloudReadAccess,
    cloudSync,
    cloudNotices,
    markCloudNoticeRead,
    refreshRecordings,
  } = useSafetyAudio();

  const [recordings, setRecordings] = useState<SafetyAudioCloudRecording[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busyRecordingId, setBusyRecordingId] = useState<string | null>(null);

  const soundRef = useRef<Awaited<ReturnType<typeof createSafetyAudioPlayback>> | null>(null);

  const refreshCloudRecordings = useCallback(async () => {
    if (!hasCloudReadAccess) {
      setRecordings([]);
      return;
    }

    setIsLoading(true);
    const { recordings: rows, error } = await listMySafetyAudioCloudRecordings({
      limit: 200,
    });
    setIsLoading(false);

    if (error) {
      Alert.alert('Unable to load cloud recordings', error.message || 'Please try again.');
      return;
    }

    setRecordings(rows);
  }, [hasCloudReadAccess]);

  useEffect(() => {
    void refreshCloudRecordings();
  }, [refreshCloudRecordings]);

  useEffect(() => {
    return () => {
      void unloadSafetyAudio(soundRef.current);
      soundRef.current = null;
    };
  }, []);

  const handlePlayToggle = useCallback(async (recording: SafetyAudioCloudRecording) => {
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
      setPlayingId(null);
    }

    try {
      const downloadUrl = await getSafetyAudioDownloadUrl(recording.id);
      const sound = await createSafetyAudioPlayback(downloadUrl.signedUrl);
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
    } catch (error) {
      Alert.alert('Unable to play cloud recording', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [playingId]);

  const handleDownload = useCallback(async (recording: SafetyAudioCloudRecording) => {
    setBusyRecordingId(recording.id);
    try {
      const downloadUrl = await getSafetyAudioDownloadUrl(recording.id);
      const rootDirectory = await ensureSafetyAudioRootDirectory();
      const importDirectory = `${rootDirectory}cloud-manual-downloads/`;
      const directoryInfo = await FileSystem.getInfoAsync(importDirectory);
      if (!directoryInfo.exists) {
        await FileSystem.makeDirectoryAsync(importDirectory, { intermediates: true });
      }

      const tempUri = `${importDirectory}${recording.id}-${Date.now()}.m4a`;
      const downloadResult = await downloadSafetyAudioCloudRecordingToLocalFile({
        signedUrl: downloadUrl.signedUrl,
        targetUri: tempUri,
      });

      if (downloadResult.error || !downloadResult.uri) {
        throw downloadResult.error || new Error('Unable to download cloud recording.');
      }

      await persistSafetyAudioSegmentFromTemp({
        tempUri: downloadResult.uri,
        sessionId: `cloud-manual-${recording.id}`,
        createdAtIso: recording.recorded_at,
        durationMs: Number(recording.duration_ms || 0),
        contextType: 'manual',
        contextId: null,
        source: 'cloud_download',
      });

      await refreshRecordings();
      Alert.alert('Downloaded', 'Cloud recording saved to local safety recordings.');
    } catch (error) {
      Alert.alert('Unable to download', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusyRecordingId(null);
    }
  }, [refreshRecordings]);

  const handleDelete = useCallback((recording: SafetyAudioCloudRecording) => {
    Alert.alert(
      'Delete Cloud Recording?',
      'This removes the cloud copy permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyRecordingId(recording.id);
              const { success, error } = await deleteSafetyAudioCloudRecording(recording.id);
              setBusyRecordingId(null);

              if (!success || error) {
                Alert.alert('Unable to delete cloud recording', error?.message || 'Please try again.');
                return;
              }

              trackEvent('safety_audio_cloud_deleted', {});
              await refreshCloudRecordings();
            })();
          },
        },
      ],
    );
  }, [refreshCloudRecordings]);

  if (!hasCloudReadAccess) {
    return (
      <ScreenScaffold scrollable contentContainerStyle={styles.content}>
        <Header title="Cloud Safety Audio" showBack onBackPress={() => navigation.goBack()} />

        <Card variant="outlined" style={styles.lockedCard}>
          <Text style={styles.lockedTitle}>Wingman Pro Feature</Text>
          <Text style={styles.lockedBody}>
            Cloud safety audio storage is available with Wingman Pro. Free users keep local-only safety recordings with 7-day auto-delete.
          </Text>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Text style={styles.primaryActionText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </Card>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold scrollable contentContainerStyle={styles.content}>
      <Header
        title="Cloud Safety Audio"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <InlineBanner
        title={isCloudUploadProEnabled ? 'Pro cloud storage active' : 'Grace read-only access active'}
        message={isCloudUploadProEnabled
          ? `Automatic upload is enabled. Queue: ${cloudSync.queueCount} pending.`
          : 'Uploads are disabled during grace. You can still play, download, and delete existing cloud recordings.'}
        variant={isCloudUploadProEnabled ? 'success' : 'warning'}
      />

      {cloudNotices.length > 0 ? (
        <Card variant="outlined" style={styles.noticeCard}>
          <SectionHeader title="Cloud Notices" subtitle={`${cloudNotices.length} unread`} />
          {cloudNotices.slice(0, 5).map((notice) => (
            <TouchableOpacity
              key={notice.id}
              style={styles.noticeRow}
              onPress={() => { void markCloudNoticeRead(notice.id); }}
            >
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle}>{notice.title}</Text>
                <Text style={styles.noticeMessage}>{notice.message}</Text>
              </View>
              <Ionicons name="checkmark" size={14} color={tokens.colors.text.tertiary} />
            </TouchableOpacity>
          ))}
        </Card>
      ) : null}

      <Card variant="outlined" style={styles.listCard}>
        <SectionHeader
          title="Cloud Recordings"
          subtitle={`${recordings.length} available`}
          actionLabel="Refresh"
          onPressAction={() => { void refreshCloudRecordings(); }}
        />

        {isLoading ? (
          <Text style={styles.helperText}>Loading cloud recordings...</Text>
        ) : recordings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={20} color={tokens.colors.text.tertiary} />
            <Text style={styles.helperText}>No cloud recordings yet.</Text>
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
                  <Text style={styles.recordingTitle}>{formatDateTime(item.recorded_at)}</Text>
                  <Text style={styles.recordingSubtitle}>
                    {formatDuration(item.duration_ms)} • {formatBytes(item.size_bytes)}
                  </Text>
                  <Text style={styles.recordingSubtitle}>
                    Expires {formatDateTime(item.expires_at)} • {item.status.replace(/_/g, ' ')}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => { void handlePlayToggle(item); }}
                  >
                    <Ionicons
                      name={playingId === item.id ? 'stop-circle-outline' : 'play-circle-outline'}
                      size={18}
                      color={tokens.colors.accent.primary}
                    />
                    <Text style={styles.actionText}>{playingId === item.id ? 'Stop' : 'Play'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    disabled={busyRecordingId === item.id}
                    onPress={() => { void handleDownload(item); }}
                  >
                    <Ionicons
                      name="download-outline"
                      size={18}
                      color={tokens.colors.text.primary}
                    />
                    <Text style={styles.actionText}>{busyRecordingId === item.id ? 'Working' : 'Download'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    disabled={busyRecordingId === item.id}
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
  lockedCard: {
    gap: spacing.sm,
  },
  lockedTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  lockedBody: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  primaryAction: {
    minHeight: 40,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryActionText: {
    ...typography.presets.caption,
    color: colors.text.inverse,
    fontWeight: typography.weights.semibold,
  },
  noticeCard: {
    gap: spacing.xs,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  noticeCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  noticeTitle: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  noticeMessage: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  listCard: {
    gap: spacing.sm,
  },
  helperText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  emptyState: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
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

import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackStatus,
} from 'expo-av';
import { Platform } from 'react-native';
import type {
  SafetyAudioRecording,
  SafetyAudioSession,
} from '../../types';
import { persistSafetyAudioSegmentFromTemp } from './safetyAudioStorage';

export const SAFETY_AUDIO_SEGMENT_DURATION_MS = 5 * 60 * 1000;

type SafetyAudioContextType = SafetyAudioRecording['contextType'];
type SafetyAudioSource = SafetyAudioRecording['source'];
type RecordingStatus = Awaited<ReturnType<Audio.Recording['getStatusAsync']>>;

interface BackgroundServiceLike {
  start: (task: () => Promise<void>, options: Record<string, unknown>) => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}

type RecorderLifecycleEvent =
  | { type: 'started'; session: SafetyAudioSession }
  | { type: 'segment_saved'; recording: SafetyAudioRecording }
  | { type: 'stopped'; reason: string }
  | { type: 'error'; error: Error };

interface SegmentDescriptor {
  contextType: SafetyAudioContextType;
  contextId: string | null;
  source: SafetyAudioSource;
}

let activeRecording: Audio.Recording | null = null;
let activeSession: SafetyAudioSession | null = null;
let activeSegmentStartedAtIso: string | null = null;
let activeSegmentDescriptor: SegmentDescriptor | null = null;
let segmentRotationTimer: ReturnType<typeof setTimeout> | null = null;
let rotationInProgress = false;
let stopRequested = false;
let backgroundServiceModule: BackgroundServiceLike | null | undefined;
const listeners = new Set<(event: RecorderLifecycleEvent) => void>();

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16_000,
    numberOfChannels: 1,
    bitRate: 48_000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16_000,
    numberOfChannels: 1,
    bitRate: 48_000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
  isMeteringEnabled: false,
};

function emit(event: RecorderLifecycleEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('Safety audio recorder listener failed', error);
    }
  }
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string' && error.trim()) {
    return new Error(error);
  }
  return new Error(fallback);
}

function getBackgroundService(): BackgroundServiceLike | null {
  if (backgroundServiceModule !== undefined) {
    return backgroundServiceModule;
  }

  try {
    const requiredModule = require('react-native-background-actions') as {
      default?: BackgroundServiceLike;
    };
    backgroundServiceModule = requiredModule.default || null;
  } catch {
    backgroundServiceModule = null;
  }

  return backgroundServiceModule;
}

function clearSegmentTimer(): void {
  if (!segmentRotationTimer) {
    return;
  }

  clearTimeout(segmentRotationTimer);
  segmentRotationTimer = null;
}

async function ensureAudioModeForRecording(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

async function restoreAudioModeAfterRecording(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // no-op
  }
}

function resolveDurationMs(status: RecordingStatus | null): number {
  if (!status || typeof status !== 'object' || !('durationMillis' in status)) {
    return 0;
  }

  const maybeDuration = Number(status.durationMillis || 0);
  return Number.isFinite(maybeDuration) && maybeDuration > 0 ? maybeDuration : 0;
}

async function startBackgroundKeepAlive(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const backgroundService = getBackgroundService();
  if (!backgroundService) {
    return;
  }

  try {
    if (backgroundService.isRunning()) {
      return;
    }

    await backgroundService.start(async () => {
      while (backgroundService.isRunning()) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 30_000);
        });
      }
    }, {
      taskName: 'wingman-safety-audio',
      taskTitle: 'Safety audio recording active',
      taskDesc: 'Wingman is recording local safety audio on this device.',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#1D4ED8',
      linkingURI: 'wingman://',
      parameters: {},
    });
  } catch (error) {
    console.error('Unable to start background safety audio keepalive service', error);
  }
}

async function stopBackgroundKeepAlive(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const backgroundService = getBackgroundService();
  if (!backgroundService) {
    return;
  }

  try {
    if (backgroundService.isRunning()) {
      await backgroundService.stop();
    }
  } catch (error) {
    console.error('Unable to stop background safety audio keepalive service', error);
  }
}

async function prepareAndStartSegment(): Promise<void> {
  if (!activeSession || !activeSegmentDescriptor) {
    throw new Error('Safety audio session metadata is missing.');
  }

  const segmentStartedAtIso = new Date().toISOString();
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(RECORDING_OPTIONS);
  await recording.startAsync();

  activeRecording = recording;
  activeSegmentStartedAtIso = segmentStartedAtIso;
  activeSession = {
    ...activeSession,
    segmentStartedAt: segmentStartedAtIso,
  };

  clearSegmentTimer();
  segmentRotationTimer = setTimeout(() => {
    void finalizeCurrentSegment('segment-rotation', { continueRecording: true });
  }, SAFETY_AUDIO_SEGMENT_DURATION_MS);
}

async function finalizeCurrentSegment(
  reason: string,
  options: { continueRecording: boolean },
): Promise<void> {
  if (!activeRecording || !activeSession || !activeSegmentDescriptor) {
    if (!options.continueRecording) {
      clearSegmentTimer();
    }
    return;
  }

  if (rotationInProgress) {
    return;
  }

  rotationInProgress = true;
  clearSegmentTimer();

  const recording = activeRecording;
  activeRecording = null;

  try {
    let status: RecordingStatus | null = null;
    try {
      status = await recording.getStatusAsync();
    } catch {
      status = null;
    }

    await recording.stopAndUnloadAsync();
    const tempUri = recording.getURI();
    if (tempUri) {
      const savedRecording = await persistSafetyAudioSegmentFromTemp({
        tempUri,
        sessionId: activeSession.sessionId,
        createdAtIso: activeSegmentStartedAtIso || new Date().toISOString(),
        durationMs: resolveDurationMs(status),
        contextType: activeSegmentDescriptor.contextType,
        contextId: activeSegmentDescriptor.contextId,
        source: activeSegmentDescriptor.source,
      });

      emit({
        type: 'segment_saved',
        recording: savedRecording,
      });
    }
  } catch (error) {
    emit({
      type: 'error',
      error: toError(error, 'Unable to save local safety audio segment.'),
    });
  } finally {
    rotationInProgress = false;
  }

  if (options.continueRecording && !stopRequested && activeSession) {
    try {
      await prepareAndStartSegment();
    } catch (error) {
      emit({
        type: 'error',
        error: toError(error, 'Unable to continue local safety audio recording.'),
      });
      await stopSafetyAudioRecorder('recording-error');
    }
    return;
  }

  emit({ type: 'stopped', reason });
}

export function subscribeSafetyAudioRecorder(
  listener: (event: RecorderLifecycleEvent) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveSafetyAudioSession(): SafetyAudioSession | null {
  return activeSession;
}

export function isSafetyAudioRecorderRunning(): boolean {
  return !!activeSession && !!activeRecording;
}

export async function updateSafetyAudioSessionContext(
  contextKeys: string[],
): Promise<void> {
  if (!activeSession) {
    return;
  }

  activeSession = {
    ...activeSession,
    contextKeys: [...contextKeys],
  };
}

export async function startSafetyAudioRecorder(input: {
  sessionId?: string;
  contextType: SafetyAudioContextType;
  contextId?: string | null;
  source: SafetyAudioSource;
  contextKeys: string[];
  reason: SafetyAudioSession['reason'];
}): Promise<{
  started: boolean;
  session: SafetyAudioSession | null;
  error: Error | null;
}> {
  try {
    if (activeSession && activeRecording) {
      await updateSafetyAudioSessionContext(input.contextKeys);
      return {
        started: false,
        session: activeSession,
        error: null,
      };
    }

    const nowIso = new Date().toISOString();
    const sessionId = input.sessionId || `safety-audio-session-${Date.now()}`;

    stopRequested = false;
    activeSession = {
      sessionId,
      startedAt: nowIso,
      segmentStartedAt: nowIso,
      contextKeys: [...input.contextKeys],
      reason: input.reason,
    };
    activeSegmentDescriptor = {
      contextType: input.contextType,
      contextId: input.contextId || null,
      source: input.source,
    };

    await ensureAudioModeForRecording();
    await prepareAndStartSegment();
    await startBackgroundKeepAlive();

    if (activeSession) {
      emit({
        type: 'started',
        session: activeSession,
      });
    }

    return {
      started: true,
      session: activeSession,
      error: null,
    };
  } catch (error) {
    await stopBackgroundKeepAlive();
    await restoreAudioModeAfterRecording();
    activeRecording = null;
    activeSession = null;
    activeSegmentDescriptor = null;
    activeSegmentStartedAtIso = null;
    clearSegmentTimer();
    stopRequested = false;

    return {
      started: false,
      session: null,
      error: toError(error, 'Unable to start local safety audio recording.'),
    };
  }
}

export async function stopSafetyAudioRecorder(reason = 'manual-stop'): Promise<void> {
  stopRequested = true;
  await finalizeCurrentSegment(reason, { continueRecording: false });

  clearSegmentTimer();
  activeRecording = null;
  activeSegmentStartedAtIso = null;
  activeSegmentDescriptor = null;
  activeSession = null;
  rotationInProgress = false;
  stopRequested = false;

  await stopBackgroundKeepAlive();
  await restoreAudioModeAfterRecording();
}

export async function createSafetyAudioPlayback(uri: string): Promise<Audio.Sound> {
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: false, progressUpdateIntervalMillis: 300 },
  );
  return sound;
}

export async function playSafetyAudio(
  sound: Audio.Sound,
  statusCallback?: (status: AVPlaybackStatus) => void,
): Promise<void> {
  if (statusCallback) {
    sound.setOnPlaybackStatusUpdate(statusCallback);
  }
  await sound.playAsync();
}

export async function stopSafetyAudio(sound: Audio.Sound): Promise<void> {
  try {
    await sound.stopAsync();
  } catch {
    // no-op
  }
}

export async function unloadSafetyAudio(sound: Audio.Sound | null): Promise<void> {
  if (!sound) {
    return;
  }

  try {
    await sound.unloadAsync();
  } catch {
    // no-op
  }
}

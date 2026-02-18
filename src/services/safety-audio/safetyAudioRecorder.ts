import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackStatus,
} from 'expo-av';
import { Platform } from 'react-native';
import type {
  SafetyAudioInterruptionReason,
  SafetyAudioRecording,
  SafetyAudioSession,
} from '../../types';
import {
  clearActiveSafetyAudioSegmentMetadata,
  persistSafetyAudioSegmentFromTemp,
  recoverSafetyAudioSegmentFromActiveMetadata,
  writeActiveSafetyAudioSegmentMetadata,
} from './safetyAudioStorage';

export const SAFETY_AUDIO_SEGMENT_DURATION_MS = 30 * 1000;

export type SafetyAudioRecorderState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'interrupted';

type SafetyAudioContextType = SafetyAudioRecording['contextType'];
type SafetyAudioSource = SafetyAudioRecording['source'];
type RecorderStatus = Awaited<ReturnType<Audio.Recording['getStatusAsync']>>;

interface BackgroundServiceLike {
  start: (task: () => Promise<void>, options: Record<string, unknown>) => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}

type RecorderLifecycleEvent =
  | { type: 'started'; session: SafetyAudioSession }
  | { type: 'state_changed'; session: SafetyAudioSession | null; reason: string; previousState: SafetyAudioSession['state'] | null }
  | { type: 'segment_saved'; recording: SafetyAudioRecording }
  | { type: 'recovered'; recording: SafetyAudioRecording }
  | { type: 'stopped'; reason: string }
  | { type: 'error'; error: Error };

interface SegmentDescriptor {
  contextType: SafetyAudioContextType;
  contextId: string | null;
  source: SafetyAudioSource;
}

interface PreparedSegment {
  recording: Audio.Recording;
  segmentStartedAtIso: string;
  segmentStartedAtMs: number;
  tempUri: string;
}

let activeRecording: Audio.Recording | null = null;
let activeSession: SafetyAudioSession | null = null;
let activeSegmentStartedAtIso: string | null = null;
let activeSegmentStartedAtMs: number | null = null;
let activeSegmentDescriptor: SegmentDescriptor | null = null;
let segmentRotationTimer: ReturnType<typeof setTimeout> | null = null;
let rotationInProgress = false;
let stopRequested = false;
let interruptionHandlingInProgress = false;
let statusObserverToken = 0;
let sessionElapsedAccumulatedMs = 0;
let backgroundServiceModule: BackgroundServiceLike | null | undefined;
let recorderState: SafetyAudioRecorderState = 'idle';
let recorderTransition: Promise<void> = Promise.resolve();
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

function runRecorderTransition<T>(operation: () => Promise<T>): Promise<T> {
  const run = recorderTransition.then(operation, operation);
  recorderTransition = run.then(() => undefined, () => undefined);
  return run;
}

function getBackgroundService(): BackgroundServiceLike | null {
  if (backgroundServiceModule !== undefined) {
    return backgroundServiceModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
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

function resetActiveRecorderMemory(): void {
  clearSegmentTimer();
  activeRecording = null;
  activeSession = null;
  activeSegmentDescriptor = null;
  activeSegmentStartedAtIso = null;
  activeSegmentStartedAtMs = null;
  rotationInProgress = false;
  stopRequested = false;
  interruptionHandlingInProgress = false;
  sessionElapsedAccumulatedMs = 0;
  statusObserverToken += 1;
}

function resolveDurationMs(status: RecorderStatus | null): number {
  if (!status || typeof status !== 'object' || !('durationMillis' in status)) {
    return 0;
  }

  const maybeDuration = Number(status.durationMillis || 0);
  return Number.isFinite(maybeDuration) && maybeDuration > 0 ? maybeDuration : 0;
}

function computeElapsedMs(referenceMs = Date.now()): number {
  let total = sessionElapsedAccumulatedMs;
  if (recorderState === 'recording' && activeSegmentStartedAtMs) {
    total += Math.max(0, referenceMs - activeSegmentStartedAtMs);
  }
  return Math.max(0, total);
}

function publishStateChange(
  nextState: SafetyAudioSession['state'],
  reason: string,
  interruptionReason?: SafetyAudioInterruptionReason,
): void {
  if (!activeSession) {
    return;
  }

  const nowIso = new Date().toISOString();
  const previousState = activeSession.state;
  const nextElapsed = computeElapsedMs();
  activeSession = {
    ...activeSession,
    state: nextState,
    elapsedMsAtLastStateChange: nextElapsed,
    lastStateChangedAt: nowIso,
    ...(interruptionReason
      ? { lastInterruptionReason: interruptionReason }
      : {}),
  };

  emit({
    type: 'state_changed',
    session: activeSession,
    reason,
    previousState,
  });
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

async function syncActiveSegmentMetadata(state: 'starting' | 'recording' | 'paused' | 'interrupted'): Promise<void> {
  if (!activeRecording || !activeSegmentDescriptor || !activeSession || !activeSegmentStartedAtIso) {
    if (state === 'paused' || state === 'interrupted') {
      await clearActiveSafetyAudioSegmentMetadata();
    }
    return;
  }

  const tempUri = activeRecording.getURI();
  if (!tempUri) {
    return;
  }

  await writeActiveSafetyAudioSegmentMetadata({
    sessionId: activeSession.sessionId,
    tempUri,
    segmentStartedAt: activeSegmentStartedAtIso,
    state,
    updatedAt: new Date().toISOString(),
    contextType: activeSegmentDescriptor.contextType,
    contextId: activeSegmentDescriptor.contextId,
    source: activeSegmentDescriptor.source,
  });
}

function scheduleSegmentRotation(): void {
  clearSegmentTimer();
  segmentRotationTimer = setTimeout(() => {
    void runRecorderTransition(async () => {
      if (stopRequested || recorderState !== 'recording' || !activeSession || !activeSegmentDescriptor) {
        return;
      }
      await rotateSegment('checkpoint-rotate');
    });
  }, SAFETY_AUDIO_SEGMENT_DURATION_MS);
}

async function handleRecordingStatusUpdate(status: RecorderStatus, token: number): Promise<void> {
  if (token !== statusObserverToken) {
    return;
  }

  if (status.mediaServicesDidReset) {
    await handleInterruption('media_services_reset');
    return;
  }

  if (
    recorderState === 'recording'
    && !stopRequested
    && !rotationInProgress
    && !status.isRecording
    && !status.isDoneRecording
  ) {
    await handleInterruption('audio_focus_loss');
  }
}

async function createPreparedRecordingSegment(): Promise<PreparedSegment> {
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(RECORDING_OPTIONS);
  const observerToken = ++statusObserverToken;
  recording.setOnRecordingStatusUpdate((status) => {
    void handleRecordingStatusUpdate(status, observerToken);
  });
  await recording.startAsync();

  const startedAtIso = new Date().toISOString();
  const startedAtMs = Date.now();
  const tempUri = recording.getURI() || '';

  return {
    recording,
    segmentStartedAtIso: startedAtIso,
    segmentStartedAtMs: startedAtMs,
    tempUri,
  };
}

function applyPreparedSegment(segment: PreparedSegment): void {
  activeRecording = segment.recording;
  activeSegmentStartedAtIso = segment.segmentStartedAtIso;
  activeSegmentStartedAtMs = segment.segmentStartedAtMs;

  if (activeSession) {
    activeSession = {
      ...activeSession,
      segmentStartedAt: segment.segmentStartedAtIso,
    };
  }

  scheduleSegmentRotation();
}

async function startNewSegment(): Promise<void> {
  if (!activeSession || !activeSegmentDescriptor) {
    throw new Error('Safety audio session metadata is missing.');
  }

  const segment = await createPreparedRecordingSegment();
  applyPreparedSegment(segment);
  await syncActiveSegmentMetadata('recording');
}

async function finalizeCurrentSegment(reason: string): Promise<void> {
  if (!activeRecording || !activeSession || !activeSegmentDescriptor) {
    clearSegmentTimer();
    await clearActiveSafetyAudioSegmentMetadata();
    return;
  }

  if (rotationInProgress) {
    return;
  }

  rotationInProgress = true;
  clearSegmentTimer();

  const recording = activeRecording;
  const segmentStartedAtIso = activeSegmentStartedAtIso || new Date().toISOString();
  const segmentStartedAtMs = activeSegmentStartedAtMs || Date.now();
  activeRecording = null;
  activeSegmentStartedAtIso = null;
  activeSegmentStartedAtMs = null;
  statusObserverToken += 1;

  try {
    recording.setOnRecordingStatusUpdate(null);
  } catch {
    // no-op
  }

  try {
    let status: RecorderStatus | null = null;
    try {
      status = await recording.getStatusAsync();
    } catch {
      status = null;
    }

    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // no-op
    }

    const durationMs = resolveDurationMs(status) || Math.max(0, Date.now() - segmentStartedAtMs);
    const tempUri = recording.getURI();
    if (tempUri) {
      const savedRecording = await persistSafetyAudioSegmentFromTemp({
        tempUri,
        sessionId: activeSession.sessionId,
        createdAtIso: segmentStartedAtIso,
        durationMs,
        contextType: activeSegmentDescriptor.contextType,
        contextId: activeSegmentDescriptor.contextId,
        source: activeSegmentDescriptor.source,
      });

      sessionElapsedAccumulatedMs += durationMs;
      emit({
        type: 'segment_saved',
        recording: savedRecording,
      });
    }
  } catch (error) {
    emit({
      type: 'error',
      error: toError(error, `Unable to save local safety audio segment (${reason}).`),
    });
  } finally {
    rotationInProgress = false;
    await clearActiveSafetyAudioSegmentMetadata();
  }
}

async function rotateSegment(reason: string): Promise<void> {
  if (!activeSession || !activeSegmentDescriptor || stopRequested) {
    return;
  }

  recorderState = 'starting';
  publishStateChange('starting', `${reason}:next-segment`);
  await finalizeCurrentSegment(reason);

  if (stopRequested || !activeSession || !activeSegmentDescriptor) {
    return;
  }

  try {
    await startNewSegment();
    recorderState = 'recording';
    publishStateChange('recording', `${reason}:resumed`);
  } catch (error) {
    recorderState = 'interrupted';
    publishStateChange('interrupted', `${reason}:restart-failed`, 'unknown');
    emit({
      type: 'error',
      error: toError(error, 'Unable to continue local safety audio recording.'),
    });
  }
}

async function handleInterruption(reason: SafetyAudioInterruptionReason): Promise<void> {
  if (interruptionHandlingInProgress || stopRequested) {
    return;
  }

  interruptionHandlingInProgress = true;
  try {
    await runRecorderTransition(async () => {
      if (stopRequested || recorderState !== 'recording' || !activeSession || !activeSegmentDescriptor) {
        return;
      }

      recorderState = 'paused';
      publishStateChange('paused', 'interruption-detected', reason);
      await finalizeCurrentSegment(`interruption-${reason}`);

      if (stopRequested || !activeSession || !activeSegmentDescriptor) {
        return;
      }

      recorderState = 'starting';
      publishStateChange('starting', 'interruption-recovery-start', reason);

      try {
        await startNewSegment();
        recorderState = 'recording';
        publishStateChange('recording', 'interruption-recovery-resumed');
      } catch (error) {
        recorderState = 'interrupted';
        publishStateChange('interrupted', 'interruption-recovery-failed', reason);
        emit({
          type: 'error',
          error: toError(error, 'Safety audio recording was interrupted and could not resume.'),
        });
      }
    });
  } finally {
    interruptionHandlingInProgress = false;
  }
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

export function getSafetyAudioRecorderState(): SafetyAudioRecorderState {
  return recorderState;
}

export function isSafetyAudioRecorderRunning(): boolean {
  return recorderState === 'recording' && !!activeSession;
}

export async function recoverSafetyAudioFromCrash(): Promise<{
  recoveredCount: number;
  recoveredDurationMs: number;
}> {
  const recovery = await recoverSafetyAudioSegmentFromActiveMetadata();
  if (!recovery.recovered) {
    return {
      recoveredCount: 0,
      recoveredDurationMs: 0,
    };
  }

  emit({
    type: 'recovered',
    recording: recovery.recovered,
  });

  return {
    recoveredCount: 1,
    recoveredDurationMs: recovery.recovered.durationMs,
  };
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
  return await runRecorderTransition(async () => {
    if ((recorderState === 'recording' || recorderState === 'starting') && activeSession) {
      await updateSafetyAudioSessionContext(input.contextKeys);
      return {
        started: false,
        session: activeSession,
        error: null,
      };
    }

    if ((recorderState === 'paused' || recorderState === 'interrupted') && activeSession && activeSegmentDescriptor) {
      recorderState = 'starting';
      publishStateChange('starting', 'manual-restart-requested');
      await updateSafetyAudioSessionContext(input.contextKeys);
      try {
        await startNewSegment();
        recorderState = 'recording';
        publishStateChange('recording', 'manual-restart-success');
        return {
          started: true,
          session: activeSession,
          error: null,
        };
      } catch (error) {
        recorderState = 'interrupted';
        publishStateChange('interrupted', 'manual-restart-failed', 'unknown');
        return {
          started: false,
          session: activeSession,
          error: toError(error, 'Unable to restart local safety audio recording.'),
        };
      }
    }

    recorderState = 'starting';
    stopRequested = false;
    sessionElapsedAccumulatedMs = 0;

    const nowIso = new Date().toISOString();
    const sessionId = input.sessionId || `safety-audio-session-${Date.now()}`;
    const nextSession: SafetyAudioSession = {
      sessionId,
      startedAt: nowIso,
      segmentStartedAt: nowIso,
      contextKeys: [...input.contextKeys],
      reason: input.reason,
      state: 'starting',
      elapsedMsAtLastStateChange: 0,
      lastStateChangedAt: nowIso,
    };
    const nextDescriptor: SegmentDescriptor = {
      contextType: input.contextType,
      contextId: input.contextId || null,
      source: input.source,
    };

    activeSession = nextSession;
    activeSegmentDescriptor = nextDescriptor;

    try {
      await ensureAudioModeForRecording();
      await startBackgroundKeepAlive();
      await startNewSegment();

      recorderState = 'recording';
      publishStateChange('recording', 'recording-started');
      emit({
        type: 'started',
        session: activeSession,
      });

      return {
        started: true,
        session: activeSession,
        error: null,
      };
    } catch (error) {
      const normalizedError = toError(error, 'Unable to start local safety audio recording.');
      const errorMessage = normalizedError.message.toLowerCase();

      if (errorMessage.includes('recorder is already prepared') && activeSession && activeRecording) {
        recorderState = 'recording';
        publishStateChange('recording', 'start-reconciled-already-prepared');
        await updateSafetyAudioSessionContext(input.contextKeys);
        return {
          started: false,
          session: activeSession,
          error: null,
        };
      }

      await stopBackgroundKeepAlive();
      await restoreAudioModeAfterRecording();
      await clearActiveSafetyAudioSegmentMetadata();
      resetActiveRecorderMemory();
      recorderState = 'idle';

      return {
        started: false,
        session: null,
        error: normalizedError,
      };
    }
  });
}

export async function stopSafetyAudioRecorder(reason = 'manual-stop'): Promise<void> {
  await runRecorderTransition(async () => {
    if (recorderState === 'idle' && !activeSession && !activeRecording) {
      return;
    }

    recorderState = 'stopping';
    if (activeSession) {
      publishStateChange('stopping', reason);
    }
    stopRequested = true;

    try {
      await finalizeCurrentSegment(reason);
    } finally {
      await clearActiveSafetyAudioSegmentMetadata();
      await stopBackgroundKeepAlive();
      await restoreAudioModeAfterRecording();
      resetActiveRecorderMemory();
      recorderState = 'idle';
      emit({ type: 'stopped', reason });
    }
  });
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

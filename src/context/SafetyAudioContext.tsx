import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AppState,
  type AppStateStatus,
} from 'react-native';
import type {
  SafetyAudioContextKey,
  SafetyAudioOverrideState,
  SafetyAudioRecording,
  SafetyAudioSession,
  SafetyAudioStorageStatus,
} from '../types';
import { useLiveLocation } from './LiveLocationContext';
import { useSafety } from './SafetyContext';
import {
  getSafetyAudioPermissionState,
  openSafetyAudioSystemSettings,
  requestSafetyAudioPermission,
} from '../services/safety-audio/safetyAudioPermissions';
import {
  SAFETY_AUDIO_SEGMENT_DURATION_MS,
  getActiveSafetyAudioSession,
  getSafetyAudioRecorderState,
  isSafetyAudioRecorderRunning,
  recoverSafetyAudioFromCrash,
  startSafetyAudioRecorder,
  stopSafetyAudioRecorder,
  subscribeSafetyAudioRecorder,
  updateSafetyAudioSessionContext,
} from '../services/safety-audio/safetyAudioRecorder';
import { cleanupSafetyAudioRetention } from '../services/safety-audio/safetyAudioRetention';
import {
  getSafetyAudioStorageStatus,
  listSafetyAudioRecordings,
} from '../services/safety-audio/safetyAudioStorage';
import { trackEvent } from '../services/monitoring/events';

const OVERRIDES_STORAGE_KEY = 'wingman.safety_audio.overrides.v1';
const MANUAL_CONTEXT_KEY = 'manual:global';
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STORAGE_STATUS_INTERVAL_MS = 60 * 1000;

type SafetyAudioContextTypeDescriptor = {
  contextType: SafetyAudioRecording['contextType'];
  contextId: string | null;
  source: SafetyAudioRecording['source'];
};

interface SafetyAudioContextType {
  isRecording: boolean;
  isTransitioning: boolean;
  recordingState: SafetyAudioSession['state'];
  elapsedMs: number;
  activeSession: SafetyAudioSession | null;
  recordings: SafetyAudioRecording[];
  autoRecordDefaultEnabled: boolean;
  storageStatus: SafetyAudioStorageStatus;
  activeContextKeys: SafetyAudioContextKey[];
  segmentDurationMs: typeof SAFETY_AUDIO_SEGMENT_DURATION_MS;
  setAutoRecordDefaultEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  startRecording: (context?: { contextKey?: SafetyAudioContextKey }) => Promise<{ success: boolean; error?: string }>;
  stopRecording: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  toggleContextOverride: (
    contextKey: SafetyAudioContextKey,
    state: SafetyAudioOverrideState,
  ) => Promise<void>;
  getContextOverride: (contextKey: SafetyAudioContextKey) => SafetyAudioOverrideState;
  refreshRecordings: () => Promise<void>;
}

const defaultStorageStatus: SafetyAudioStorageStatus = {
  freeBytes: null,
  warning: false,
  critical: false,
  warningThresholdBytes: 500 * 1024 * 1024,
  criticalThresholdBytes: 200 * 1024 * 1024,
};

const SafetyAudioContext = createContext<SafetyAudioContextType | undefined>(undefined);

type PersistedOverrideMap = Record<string, Exclude<SafetyAudioOverrideState, null>>;

function parseTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getElapsedMsForSession(session: SafetyAudioSession | null, nowMs = Date.now()): number {
  if (!session) {
    return 0;
  }

  const baseMs = Number.isFinite(session.elapsedMsAtLastStateChange)
    ? Math.max(0, session.elapsedMsAtLastStateChange)
    : 0;

  if (session.state !== 'recording') {
    return baseMs;
  }

  const lastChangedAtMs = parseTimestamp(session.lastStateChangedAt);
  if (!lastChangedAtMs) {
    return baseMs;
  }

  return baseMs + Math.max(0, nowMs - lastChangedAtMs);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function resolveDescriptorFromContextKey(contextKey: string): SafetyAudioContextTypeDescriptor {
  if (contextKey.startsWith('booking:')) {
    return {
      contextType: 'booking',
      contextId: contextKey.slice('booking:'.length) || null,
      source: 'auto_booking',
    };
  }

  if (contextKey.startsWith('live_location:')) {
    return {
      contextType: 'live_location',
      contextId: contextKey.slice('live_location:'.length) || null,
      source: 'auto_live_location',
    };
  }

  return {
    contextType: 'manual',
    contextId: null,
    source: 'manual',
  };
}

function getOverride(
  overrides: PersistedOverrideMap,
  contextKey: string,
): SafetyAudioOverrideState {
  const value = overrides[contextKey];
  return value === 'force_on' || value === 'force_off' ? value : null;
}

function computeDesiredRecordingState(params: {
  activeContextKeys: string[];
  overrides: PersistedOverrideMap;
  autoRecordDefaultEnabled: boolean;
}): { shouldRecord: boolean; contextKeys: string[] } {
  const activeKeySet = new Set(params.activeContextKeys);
  const overrideContextKeys = Object.entries(params.overrides)
    .filter(([contextKey, state]) => {
      if (state === 'force_on') {
        return true;
      }

      if (state === 'force_off') {
        return contextKey === MANUAL_CONTEXT_KEY || activeKeySet.has(contextKey);
      }

      return false;
    })
    .map(([contextKey]) => contextKey);

  const contextKeys = unique([
    ...params.activeContextKeys,
    ...overrideContextKeys,
  ]);

  if (contextKeys.length === 0) {
    return {
      shouldRecord: false,
      contextKeys: [],
    };
  }

  const hasForceOff = contextKeys.some((contextKey) => getOverride(params.overrides, contextKey) === 'force_off');
  if (hasForceOff) {
    return {
      shouldRecord: false,
      contextKeys,
    };
  }

  const hasForceOn = contextKeys.some((contextKey) => getOverride(params.overrides, contextKey) === 'force_on');
  if (hasForceOn) {
    return {
      shouldRecord: true,
      contextKeys,
    };
  }

  return {
    shouldRecord: params.autoRecordDefaultEnabled && params.activeContextKeys.length > 0,
    contextKeys,
  };
}

async function confirmPermissionExplanation(): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Enable Microphone for Safety Audio',
      'Wingman records compressed safety audio locally on this device only and never uploads it. This helps protect you during active meetups.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Continue',
          onPress: () => resolve(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      },
    );
  });
}

export const SafetyAudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences, sessions, updatePreferences } = useSafety();
  const { activeShares } = useLiveLocation();

  const [isRecording, setIsRecording] = useState<boolean>(isSafetyAudioRecorderRunning());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeSession, setActiveSession] = useState<SafetyAudioSession | null>(getActiveSafetyAudioSession());
  const [recordingState, setRecordingState] = useState<SafetyAudioSession['state']>(
    getActiveSafetyAudioSession()?.state || 'stopped',
  );
  const [elapsedMs, setElapsedMs] = useState<number>(
    getElapsedMsForSession(getActiveSafetyAudioSession()),
  );
  const [recordings, setRecordings] = useState<SafetyAudioRecording[]>([]);
  const [storageStatus, setStorageStatus] = useState<SafetyAudioStorageStatus>(defaultStorageStatus);
  const [overrides, setOverrides] = useState<PersistedOverrideMap>({});
  const [lastEvalTimestamp, setLastEvalTimestamp] = useState(0);

  const isMountedRef = useRef(true);
  const overridesRef = useRef<PersistedOverrideMap>({});
  const isTransitioningRef = useRef(false);
  const reconcileInFlightRef = useRef<Promise<void> | null>(null);

  const activeBookingContextKeys = useMemo(() => (
    sessions
      .filter((session) => session.status === 'active')
      .map((session) => `booking:${session.booking_id}`)
  ), [sessions]);

  const activeLiveLocationContextKeys = useMemo(() => (
    activeShares
      .filter((share) => share.status === 'active' && parseTimestamp(share.expiresAt) > Date.now())
      .map((share) => `live_location:${share.conversationId}`)
  ), [activeShares]);

  const activeContextKeys = useMemo(() => unique([
    ...activeBookingContextKeys,
    ...activeLiveLocationContextKeys,
  ]), [activeBookingContextKeys, activeLiveLocationContextKeys]);

  const autoRecordDefaultEnabled = preferences?.auto_record_safety_audio_on_visit === true;

  const persistOverrides = useCallback(async (next: PersistedOverrideMap): Promise<void> => {
    try {
      await AsyncStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Unable to persist safety audio overrides', error);
    }
  }, []);

  const refreshRecordings = useCallback(async () => {
    const rows = await listSafetyAudioRecordings();
    if (!isMountedRef.current) {
      return;
    }
    setRecordings(rows);
  }, []);

  const refreshStorageStatus = useCallback(async () => {
    const next = await getSafetyAudioStorageStatus();
    if (!isMountedRef.current) {
      return;
    }
    setStorageStatus(next);
  }, []);

  const runRetentionCleanup = useCallback(async () => {
    const result = await cleanupSafetyAudioRetention();
    if (!isMountedRef.current) {
      return;
    }
    setRecordings(result.remaining);
    trackEvent('safety_audio_cleanup_run', {
      deletedExpiredCount: result.deletedExpiredCount,
      removedMissingCount: result.removedMissingCount,
    });
  }, []);

  const ensureMicrophonePermission = useCallback(async (): Promise<boolean> => {
    const currentPermission = await getSafetyAudioPermissionState();
    if (currentPermission.granted) {
      return true;
    }

    const confirmed = await confirmPermissionExplanation();
    if (!confirmed) {
      return false;
    }

    const requestedPermission = await requestSafetyAudioPermission();
    if (requestedPermission.granted) {
      return true;
    }

    trackEvent('safety_audio_permission_denied', {
      canAskAgain: requestedPermission.canAskAgain,
    });

    Alert.alert(
      'Microphone Permission Needed',
      requestedPermission.canAskAgain
        ? 'Safety audio recording is off because microphone access is denied. Enable microphone permission to use this feature.'
        : 'Safety audio recording is off because microphone access is blocked. Open Settings to enable microphone access for Wingman.',
      requestedPermission.canAskAgain
        ? [{ text: 'OK' }]
        : [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              void openSafetyAudioSystemSettings();
            },
          },
        ],
    );

    return false;
  }, []);

  const applyOverrides = useCallback(async (updater: (previous: PersistedOverrideMap) => PersistedOverrideMap) => {
    const next = updater(overridesRef.current);
    overridesRef.current = next;
    setOverrides(next);
    await persistOverrides(next);
  }, [persistOverrides]);

  const reconcileRecordingState = useCallback(async (): Promise<void> => {
    if (reconcileInFlightRef.current) {
      await reconcileInFlightRef.current;
      return;
    }

    const reconcilePromise = (async () => {
      const currentOverrides = overridesRef.current;
      const evaluation = computeDesiredRecordingState({
        activeContextKeys,
        overrides: currentOverrides,
        autoRecordDefaultEnabled,
      });

      if (evaluation.contextKeys.length > 0 && isSafetyAudioRecorderRunning()) {
        await updateSafetyAudioSessionContext(evaluation.contextKeys);
        if (activeSession) {
          const updatedSession: SafetyAudioSession = {
            ...activeSession,
            contextKeys: evaluation.contextKeys,
          };
          setActiveSession(updatedSession);
          setRecordingState(updatedSession.state);
          setElapsedMs(getElapsedMsForSession(updatedSession));
        }
      }

      const recorderIsRunning = isSafetyAudioRecorderRunning();
      const latestRecorderState = getSafetyAudioRecorderState();

      if (evaluation.shouldRecord === recorderIsRunning) {
        if (!evaluation.shouldRecord && (latestRecorderState === 'paused' || latestRecorderState === 'interrupted')) {
          await stopSafetyAudioRecorder('reconcile-cleanup');
          setIsRecording(false);
          setActiveSession(null);
          setRecordingState('stopped');
          setElapsedMs(0);
          return;
        }

        setIsRecording(recorderIsRunning);
        setRecordingState(getActiveSafetyAudioSession()?.state || 'stopped');
        return;
      }

      if (isTransitioningRef.current) {
        return;
      }

      isTransitioningRef.current = true;
      if (isMountedRef.current) {
        setIsTransitioning(true);
      }

      try {
        if (evaluation.shouldRecord) {
          await refreshStorageStatus();
          const latestStorage = await getSafetyAudioStorageStatus();
          if (latestStorage.critical) {
            setStorageStatus(latestStorage);
            trackEvent('safety_audio_storage_critical_stop', {
              freeBytes: latestStorage.freeBytes ?? -1,
            });
            Alert.alert(
              'Storage Too Low',
              'Safety audio recording is off because your device storage is critically low. Free up space and try again.',
            );
            return;
          }

          if (latestStorage.warning) {
            trackEvent('safety_audio_storage_low_warning', {
              freeBytes: latestStorage.freeBytes ?? -1,
            });
          }

          const hasPermission = await ensureMicrophonePermission();
          if (!hasPermission) {
            return;
          }

          const preferredForceOnContext = evaluation.contextKeys.find(
            (contextKey) => getOverride(currentOverrides, contextKey) === 'force_on',
          );
          const startContextKey = preferredForceOnContext || evaluation.contextKeys[0] || MANUAL_CONTEXT_KEY;
          const descriptor = resolveDescriptorFromContextKey(startContextKey);

          const { session, error } = await startSafetyAudioRecorder({
            sessionId: activeSession?.sessionId || undefined,
            contextType: descriptor.contextType,
            contextId: descriptor.contextId,
            source: descriptor.source,
            contextKeys: evaluation.contextKeys,
            reason: descriptor.contextType === 'manual' ? 'manual' : 'auto',
          });

          if (error || !session) {
            Alert.alert('Unable to start recording', error?.message || 'Please try again.');
            return;
          }

          setIsRecording(true);
          setActiveSession(session);
          setRecordingState(session.state);
          setElapsedMs(getElapsedMsForSession(session));
          trackEvent(descriptor.contextType === 'manual' ? 'safety_audio_start' : 'safety_audio_autostart', {
            contextType: descriptor.contextType,
          });
        } else {
          await stopSafetyAudioRecorder('context-not-active');
          setIsRecording(false);
          setActiveSession(null);
          setRecordingState('stopped');
          setElapsedMs(0);
          trackEvent('safety_audio_stop', {
            reason: 'context-not-active',
          });
        }
      } finally {
        isTransitioningRef.current = false;
        if (isMountedRef.current) {
          setIsTransitioning(false);
        }
      }
    })();

    reconcileInFlightRef.current = reconcilePromise;
    try {
      await reconcilePromise;
    } finally {
      if (reconcileInFlightRef.current === reconcilePromise) {
        reconcileInFlightRef.current = null;
      }
    }
  }, [
    activeContextKeys,
    activeSession,
    autoRecordDefaultEnabled,
    ensureMicrophonePermission,
    refreshStorageStatus,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isTransitioningRef.current = false;
      reconcileInFlightRef.current = null;
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(OVERRIDES_STORAGE_KEY);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const next: PersistedOverrideMap = {};
        for (const [contextKey, value] of Object.entries(parsed)) {
          if (value === 'force_on' || value === 'force_off') {
            next[contextKey] = value;
          }
        }
        overridesRef.current = next;
        setOverrides(next);
      } catch (error) {
        console.error('Unable to restore safety audio overrides', error);
      }
    })();
  }, []);

  useEffect(() => {
    void refreshRecordings();
    void refreshStorageStatus();
    void runRetentionCleanup();
  }, [refreshRecordings, refreshStorageStatus, runRetentionCleanup]);

  useEffect(() => {
    void (async () => {
      if (getSafetyAudioRecorderState() !== 'idle') {
        return;
      }
      const recovery = await recoverSafetyAudioFromCrash();
      if (recovery.recoveredCount > 0) {
        await refreshRecordings();
        trackEvent('safety_audio_recovery_restored', {
          recoveredCount: recovery.recoveredCount,
          recoveredDurationMs: recovery.recoveredDurationMs,
        });
      }
    })();
  }, [refreshRecordings]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      void runRetentionCleanup();
    }, CLEANUP_INTERVAL_MS);

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [runRetentionCleanup]);

  useEffect(() => {
    const storageInterval = setInterval(() => {
      void refreshStorageStatus();
    }, STORAGE_STATUS_INTERVAL_MS);

    return () => {
      clearInterval(storageInterval);
    };
  }, [refreshStorageStatus]);

  useEffect(() => {
    const appStateListener = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void runRetentionCleanup();
        void refreshStorageStatus();
      }
    });

    return () => {
      appStateListener.remove();
    };
  }, [refreshStorageStatus, runRetentionCleanup]);

  useEffect(() => {
    const unsubscribe = subscribeSafetyAudioRecorder((event) => {
      if (event.type === 'started') {
        setIsRecording(true);
        setActiveSession(event.session);
        setRecordingState(event.session.state);
        setElapsedMs(getElapsedMsForSession(event.session));
        return;
      }

      if (event.type === 'state_changed') {
        setActiveSession(event.session);
        setRecordingState(event.session?.state || 'stopped');
        setElapsedMs(getElapsedMsForSession(event.session));
        setIsRecording(event.session?.state === 'recording');
        trackEvent('safety_audio_state_changed', {
          previousState: event.previousState || 'none',
          nextState: event.session?.state || 'stopped',
          reason: event.reason,
        });

        if (
          event.session
          && (event.session.state === 'paused' || event.session.state === 'interrupted')
          && event.session.lastInterruptionReason
        ) {
          trackEvent('safety_audio_interruption_handled', {
            state: event.session.state,
            interruptionReason: event.session.lastInterruptionReason,
          });
        }
        return;
      }

      if (event.type === 'segment_saved') {
        setRecordings((previous) => [event.recording, ...previous.filter((item) => item.id !== event.recording.id)]);
        return;
      }

      if (event.type === 'recovered') {
        setRecordings((previous) => [event.recording, ...previous.filter((item) => item.id !== event.recording.id)]);
        return;
      }

      if (event.type === 'stopped') {
        setIsRecording(false);
        setActiveSession(null);
        setRecordingState('stopped');
        setElapsedMs(0);
        return;
      }

      if (event.type === 'error') {
        console.error('Safety audio recorder error', event.error);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeSession || activeSession.state !== 'recording') {
      setElapsedMs(getElapsedMsForSession(activeSession));
      return;
    }

    setElapsedMs(getElapsedMsForSession(activeSession));
    const timer = setInterval(() => {
      setElapsedMs(getElapsedMsForSession(activeSession));
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [activeSession]);

  useEffect(() => {
    const next = Date.now();
    setLastEvalTimestamp(next);
  }, [activeContextKeys, autoRecordDefaultEnabled, overrides]);

  useEffect(() => {
    const previous = overridesRef.current;
    const activeSet = new Set(activeContextKeys);
    let changed = false;
    const next: PersistedOverrideMap = {};

    for (const [contextKey, state] of Object.entries(previous)) {
      if (state === 'force_on') {
        next[contextKey] = state;
        continue;
      }

      if (contextKey === MANUAL_CONTEXT_KEY) {
        if (activeSet.size > 0) {
          next[contextKey] = state;
        } else {
          changed = true;
        }
        continue;
      }

      if (activeSet.has(contextKey)) {
        next[contextKey] = state;
        continue;
      }
      changed = true;
    }

    if (!changed) {
      return;
    }

    overridesRef.current = next;
    setOverrides(next);
    void persistOverrides(next);
  }, [activeContextKeys, persistOverrides]);

  useEffect(() => {
    if (!lastEvalTimestamp) {
      return;
    }
    void reconcileRecordingState();
  }, [lastEvalTimestamp, reconcileRecordingState]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    if (!storageStatus.critical) {
      return;
    }

    Alert.alert(
      'Recording Stopped',
      'Safety audio recording was stopped because your device is critically low on storage.',
    );

    void stopSafetyAudioRecorder('critical-storage').then(() => {
      setIsRecording(false);
      setActiveSession(null);
      setRecordingState('stopped');
      setElapsedMs(0);
      trackEvent('safety_audio_storage_critical_stop', {
        freeBytes: storageStatus.freeBytes ?? -1,
      });
    });
  }, [isRecording, storageStatus.critical, storageStatus.freeBytes]);

  const setAutoRecordDefaultEnabled = useCallback(async (
    enabled: boolean,
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await updatePreferences({
      autoRecordSafetyAudioOnVisit: enabled,
    });

    if (!result.success) {
      return result;
    }

    return { success: true };
  }, [updatePreferences]);

  const toggleContextOverride = useCallback(async (
    contextKey: SafetyAudioContextKey,
    state: SafetyAudioOverrideState,
  ): Promise<void> => {
    const normalizedContextKey = contextKey.trim();
    if (!normalizedContextKey) {
      return;
    }

    await applyOverrides((previous) => {
      const next = { ...previous };
      if (state === null) {
        delete next[normalizedContextKey];
      } else {
        next[normalizedContextKey] = state;
      }
      return next;
    });
  }, [applyOverrides]);

  const getContextOverride = useCallback((contextKey: SafetyAudioContextKey): SafetyAudioOverrideState => {
    return getOverride(overridesRef.current, contextKey);
  }, []);

  const startRecording = useCallback(async (context?: {
    contextKey?: SafetyAudioContextKey;
  }): Promise<{ success: boolean; error?: string }> => {
    const contextKey = context?.contextKey?.trim() || MANUAL_CONTEXT_KEY;
    const recorderState = getSafetyAudioRecorderState();
    trackEvent('safety_audio_start_attempt', {
      contextKey,
      recorderState,
    });

    if (isSafetyAudioRecorderRunning()) {
      await toggleContextOverride(contextKey, 'force_on');
      trackEvent('safety_audio_start_result', {
        result: 'already_in_progress',
        recorderState: getSafetyAudioRecorderState(),
      });
      return { success: true };
    }

    await toggleContextOverride(contextKey, 'force_on');
    await reconcileRecordingState();

    if (!isSafetyAudioRecorderRunning() && getSafetyAudioRecorderState() === 'starting') {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 250);
      });
      await reconcileRecordingState();
    }

    if (!isSafetyAudioRecorderRunning()) {
      await toggleContextOverride(contextKey, null);
      trackEvent('safety_audio_start_result', {
        result: 'failed',
        recorderState: getSafetyAudioRecorderState(),
      });
      return { success: false, error: 'Unable to start local safety audio recording right now.' };
    }

    trackEvent('safety_audio_start_result', {
      result: 'started',
      recorderState: getSafetyAudioRecorderState(),
    });
    return { success: true };
  }, [reconcileRecordingState, toggleContextOverride]);

  const stopRecording = useCallback(async (
    reason = 'manual-stop',
  ): Promise<{ success: boolean; error?: string }> => {
    if (reconcileInFlightRef.current) {
      await reconcileInFlightRef.current;
    }

    const contextKeysToDisable = unique([
      ...activeContextKeys,
      ...Object.keys(overridesRef.current),
      MANUAL_CONTEXT_KEY,
    ]);

    await applyOverrides((previous) => {
      const next = { ...previous };
      for (const contextKey of contextKeysToDisable) {
        next[contextKey] = 'force_off';
      }
      return next;
    });

    await stopSafetyAudioRecorder(reason);
    setIsRecording(false);
    setActiveSession(null);
    setRecordingState('stopped');
    setElapsedMs(0);
    await runRetentionCleanup();
    trackEvent('safety_audio_stop', { reason });

    return { success: true };
  }, [activeContextKeys, applyOverrides, runRetentionCleanup]);

  const value = useMemo<SafetyAudioContextType>(() => ({
    isRecording,
    isTransitioning,
    recordingState,
    elapsedMs,
    activeSession,
    recordings,
    autoRecordDefaultEnabled,
    storageStatus,
    activeContextKeys,
    segmentDurationMs: SAFETY_AUDIO_SEGMENT_DURATION_MS,
    setAutoRecordDefaultEnabled,
    startRecording,
    stopRecording,
    toggleContextOverride,
    getContextOverride,
    refreshRecordings,
  }), [
    activeContextKeys,
    activeSession,
    autoRecordDefaultEnabled,
    elapsedMs,
    getContextOverride,
    isRecording,
    isTransitioning,
    recordingState,
    recordings,
    refreshRecordings,
    setAutoRecordDefaultEnabled,
    startRecording,
    stopRecording,
    storageStatus,
    toggleContextOverride,
  ]);

  return (
    <SafetyAudioContext.Provider value={value}>
      {children}
    </SafetyAudioContext.Provider>
  );
};

export function useSafetyAudio(): SafetyAudioContextType {
  const context = useContext(SafetyAudioContext);
  if (!context) {
    throw new Error('useSafetyAudio must be used within a SafetyAudioProvider');
  }
  return context;
}

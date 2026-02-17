import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { LiveLocationShareSession } from '../../types/location';
import { upsertLiveLocationPoint } from '../api/liveLocationApi';
import { trackEvent } from '../monitoring/events';

const LIVE_LOCATION_TASK_NAME = 'wingman-live-location-updates-v1';
const LIVE_LOCATION_STORAGE_KEY = 'wingman.live_location.active_sessions.v1';

const UPDATE_TIME_INTERVAL_MS = 10_000;
const UPDATE_DISTANCE_INTERVAL_M = 15;
const MAX_LOCAL_SESSION_AGE_MS = 6 * 60 * 60 * 1_000;

interface PersistedLiveSession {
  conversationId: string;
  expiresAt: string;
}

let activeSessions = new Map<string, number>();
let hasHydratedSessions = false;
let foregroundSubscription: Location.LocationSubscription | null = null;

function nowMs(): number {
  return Date.now();
}

function isFiniteTimestamp(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function parseTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function pruneExpiredSessions(referenceMs = nowMs()): boolean {
  let changed = false;

  for (const [conversationId, expiresAtMs] of activeSessions.entries()) {
    if (!isFiniteTimestamp(expiresAtMs) || expiresAtMs <= referenceMs || expiresAtMs - referenceMs > MAX_LOCAL_SESSION_AGE_MS) {
      activeSessions.delete(conversationId);
      changed = true;
    }
  }

  return changed;
}

async function persistSessions(): Promise<void> {
  const sessions: PersistedLiveSession[] = [];

  for (const [conversationId, expiresAtMs] of activeSessions.entries()) {
    if (!conversationId || !isFiniteTimestamp(expiresAtMs)) {
      continue;
    }
    sessions.push({
      conversationId,
      expiresAt: new Date(expiresAtMs).toISOString(),
    });
  }

  await AsyncStorage.setItem(LIVE_LOCATION_STORAGE_KEY, JSON.stringify(sessions));
}

async function hydrateSessions(): Promise<void> {
  if (hasHydratedSessions) {
    return;
  }

  try {
    const raw = await AsyncStorage.getItem(LIVE_LOCATION_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PersistedLiveSession[]) : [];

    const nextSessions = new Map<string, number>();
    const referenceMs = nowMs();

    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const conversationId = typeof entry.conversationId === 'string' ? entry.conversationId : '';
      const expiresAtMs = parseTimestamp(typeof entry.expiresAt === 'string' ? entry.expiresAt : '');
      if (!conversationId || !isFiniteTimestamp(expiresAtMs) || expiresAtMs <= referenceMs) {
        continue;
      }
      nextSessions.set(conversationId, expiresAtMs);
    }

    activeSessions = nextSessions;
  } catch (error) {
    console.error('Unable to restore live location tracker sessions', error);
    activeSessions.clear();
  } finally {
    hasHydratedSessions = true;
  }
}

async function ensureTrackingTaskRegistered(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const isRegistered = await Location.hasStartedLocationUpdatesAsync(LIVE_LOCATION_TASK_NAME);
  if (isRegistered) {
    return;
  }

  await Location.startLocationUpdatesAsync(LIVE_LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: UPDATE_TIME_INTERVAL_MS,
    distanceInterval: UPDATE_DISTANCE_INTERVAL_M,
    showsBackgroundLocationIndicator: Platform.OS === 'ios',
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Live location sharing active',
      notificationBody: 'Wingman is sharing your location with your active meetup chat.',
      notificationColor: '#0F766E',
    },
  });
}

async function stopTrackingTask(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const isRegistered = await Location.hasStartedLocationUpdatesAsync(LIVE_LOCATION_TASK_NAME);
  if (!isRegistered) {
    return;
  }

  await Location.stopLocationUpdatesAsync(LIVE_LOCATION_TASK_NAME);
}

async function ensureForegroundWatcher(): Promise<void> {
  if (Platform.OS === 'web' || foregroundSubscription) {
    return;
  }

  foregroundSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: UPDATE_TIME_INTERVAL_MS,
      distanceInterval: UPDATE_DISTANCE_INTERVAL_M,
      mayShowUserSettingsDialog: true,
    },
    (location) => {
      void publishLocationSample(location.coords, location.timestamp);
    },
  );
}

function stopForegroundWatcher(): void {
  if (!foregroundSubscription) {
    return;
  }

  foregroundSubscription.remove();
  foregroundSubscription = null;
}

function buildCapturedAtIso(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) {
    return new Date().toISOString();
  }
  return new Date(timestampMs).toISOString();
}

async function publishLocationSample(
  coords: Location.LocationObjectCoords,
  timestampMs: number,
): Promise<void> {
  await hydrateSessions();

  const referenceMs = nowMs();
  const sessionsChanged = pruneExpiredSessions(referenceMs);
  if (sessionsChanged) {
    await persistSessions();
  }

  const conversationIds = Array.from(activeSessions.keys());
  if (conversationIds.length === 0) {
    return;
  }

  const capturedAt = buildCapturedAtIso(timestampMs || referenceMs);

  await Promise.allSettled(
    conversationIds.map((conversationId) => upsertLiveLocationPoint({
      conversationId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyM: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
      headingDeg: Number.isFinite(coords.heading) ? coords.heading : null,
      speedMps: Number.isFinite(coords.speed) ? coords.speed : null,
      capturedAt,
    })),
  );
}

async function startNativeTrackingIfNeeded(): Promise<void> {
  await hydrateSessions();

  if (activeSessions.size === 0) {
    await stopNativeTrackingIfIdle();
    return;
  }

  try {
    await ensureForegroundWatcher();
    await ensureTrackingTaskRegistered();
  } catch (error) {
    console.error('Unable to start native live location tracking', error);
  }
}

async function stopNativeTrackingIfIdle(): Promise<void> {
  await hydrateSessions();

  if (activeSessions.size > 0) {
    return;
  }

  stopForegroundWatcher();
  await stopTrackingTask();
}

export interface LiveLocationPermissionResult {
  canShare: boolean;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}

export async function requestLiveLocationPermissions(): Promise<LiveLocationPermissionResult> {
  try {
    const foregroundPermission = await Location.requestForegroundPermissionsAsync();
    const foregroundGranted = foregroundPermission.status === Location.PermissionStatus.GRANTED;

    if (!foregroundGranted) {
      return {
        canShare: false,
        foregroundGranted: false,
        backgroundGranted: false,
      };
    }

    let backgroundGranted = false;
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
      backgroundGranted = backgroundPermission.status === Location.PermissionStatus.GRANTED;
    }

    return {
      canShare: true,
      foregroundGranted,
      backgroundGranted,
    };
  } catch (error) {
    console.error('Unable to request live location permissions', error);
    return {
      canShare: false,
      foregroundGranted: false,
      backgroundGranted: false,
    };
  }
}

export async function syncLiveLocationTracker(
  shares: LiveLocationShareSession[],
): Promise<void> {
  await hydrateSessions();

  const referenceMs = nowMs();
  const nextSessions = new Map<string, number>();

  for (const share of shares) {
    if (!share || share.status !== 'active') {
      continue;
    }

    const conversationId = share.conversationId;
    const expiresAtMs = parseTimestamp(share.expiresAt);

    if (!conversationId || !isFiniteTimestamp(expiresAtMs) || expiresAtMs <= referenceMs) {
      continue;
    }

    nextSessions.set(conversationId, expiresAtMs);
  }

  activeSessions = nextSessions;
  await persistSessions();

  if (activeSessions.size > 0) {
    await startNativeTrackingIfNeeded();
  } else {
    await stopNativeTrackingIfIdle();
  }
}

export async function addLiveLocationShareSession(share: LiveLocationShareSession): Promise<void> {
  if (!share || share.status !== 'active') {
    return;
  }

  await hydrateSessions();

  const expiresAtMs = parseTimestamp(share.expiresAt);
  if (!share.conversationId || !isFiniteTimestamp(expiresAtMs) || expiresAtMs <= nowMs()) {
    return;
  }

  activeSessions.set(share.conversationId, expiresAtMs);
  await persistSessions();
  await startNativeTrackingIfNeeded();
}

export async function removeLiveLocationShareSession(conversationId: string): Promise<void> {
  if (!conversationId) {
    return;
  }

  await hydrateSessions();

  if (!activeSessions.has(conversationId)) {
    return;
  }

  activeSessions.delete(conversationId);
  await persistSessions();
  await stopNativeTrackingIfIdle();
}

export async function publishCurrentLocationSnapshot(): Promise<void> {
  await hydrateSessions();

  if (activeSessions.size === 0) {
    return;
  }

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    await publishLocationSample(location.coords, location.timestamp);
  } catch (error) {
    console.error('Unable to publish live location snapshot', error);
  }
}

export async function clearLiveLocationTracker(): Promise<void> {
  activeSessions.clear();
  hasHydratedSessions = true;

  try {
    await AsyncStorage.removeItem(LIVE_LOCATION_STORAGE_KEY);
  } catch (error) {
    console.error('Unable to clear live location tracker cache', error);
  }

  stopForegroundWatcher();
  await stopTrackingTask();
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(LIVE_LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LIVE_LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('Live location background task error', error.message);
      return;
    }

    const payload = (data || {}) as { locations?: Location.LocationObject[] };
    const locations = Array.isArray(payload.locations) ? payload.locations : [];
    const latest = locations[locations.length - 1];

    if (!latest) {
      return;
    }

    await publishLocationSample(latest.coords, latest.timestamp);
  });
}

export function getActiveLiveLocationConversationIds(): string[] {
  const referenceMs = nowMs();
  pruneExpiredSessions(referenceMs);
  return Array.from(activeSessions.keys());
}

export function reportLiveLocationCleanup(expiredSharesCount: number, deletedPointsCount: number): void {
  trackEvent('live_location_cleanup_run', {
    expiredSharesCount,
    deletedPointsCount,
  });
}

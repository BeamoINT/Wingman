import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { EmergencyLiveLocationShare } from '../api/emergencyLiveLocationApi';
import { upsertEmergencyLiveLocationPoint } from '../api/emergencyLiveLocationApi';

const EMERGENCY_LOCATION_TASK_NAME = 'wingman-emergency-live-location-updates-v1';
const STORAGE_KEY = 'wingman.emergency_live_location.active_shares.v1';

const UPDATE_TIME_INTERVAL_MS = 10_000;
const UPDATE_DISTANCE_INTERVAL_M = 15;
const MAX_SHARE_AGE_MS = 8 * 60 * 60 * 1000;

interface PersistedBookingShare {
  bookingId: string;
  expiresAt: string;
}

let activeBookingShares = new Map<string, number>();
let hasHydrated = false;
let foregroundSubscription: Location.LocationSubscription | null = null;

function nowMs(): number {
  return Date.now();
}

function parseTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isFiniteTimestamp(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function pruneExpiredShares(referenceMs = nowMs()): boolean {
  let changed = false;
  for (const [bookingId, expiresAtMs] of activeBookingShares.entries()) {
    if (!isFiniteTimestamp(expiresAtMs) || expiresAtMs <= referenceMs || expiresAtMs - referenceMs > MAX_SHARE_AGE_MS) {
      activeBookingShares.delete(bookingId);
      changed = true;
    }
  }

  return changed;
}

async function persistShares(): Promise<void> {
  const payload: PersistedBookingShare[] = [];

  for (const [bookingId, expiresAtMs] of activeBookingShares.entries()) {
    if (!bookingId || !isFiniteTimestamp(expiresAtMs)) {
      continue;
    }

    payload.push({
      bookingId,
      expiresAt: new Date(expiresAtMs).toISOString(),
    });
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

async function hydrateShares(): Promise<void> {
  if (hasHydrated) {
    return;
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PersistedBookingShare[]) : [];

    const next = new Map<string, number>();
    const currentMs = nowMs();

    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const bookingId = typeof entry.bookingId === 'string' ? entry.bookingId : '';
      const expiresAtMs = parseTimestamp(typeof entry.expiresAt === 'string' ? entry.expiresAt : '');

      if (!bookingId || !isFiniteTimestamp(expiresAtMs) || expiresAtMs <= currentMs) {
        continue;
      }

      next.set(bookingId, expiresAtMs);
    }

    activeBookingShares = next;
  } catch (error) {
    console.error('Unable to restore emergency live location tracker shares', error);
    activeBookingShares.clear();
  } finally {
    hasHydrated = true;
  }
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
  await hydrateShares();

  const currentMs = nowMs();
  const changed = pruneExpiredShares(currentMs);
  if (changed) {
    await persistShares();
  }

  const bookingIds = Array.from(activeBookingShares.keys());
  if (bookingIds.length === 0) {
    return;
  }

  const capturedAt = buildCapturedAtIso(timestampMs || currentMs);

  await Promise.allSettled(
    bookingIds.map((bookingId) => upsertEmergencyLiveLocationPoint({
      bookingId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyM: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
      headingDeg: Number.isFinite(coords.heading) ? coords.heading : null,
      speedMps: Number.isFinite(coords.speed) ? coords.speed : null,
      capturedAt,
    })),
  );
}

async function ensureTrackingTaskRegistered(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const isRegistered = await Location.hasStartedLocationUpdatesAsync(EMERGENCY_LOCATION_TASK_NAME);
  if (isRegistered) {
    return;
  }

  await Location.startLocationUpdatesAsync(EMERGENCY_LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: UPDATE_TIME_INTERVAL_MS,
    distanceInterval: UPDATE_DISTANCE_INTERVAL_M,
    showsBackgroundLocationIndicator: Platform.OS === 'ios',
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Emergency location sharing active',
      notificationBody: 'Wingman is sharing your live location with your emergency contacts.',
      notificationColor: '#B91C1C',
    },
  });
}

async function stopTrackingTask(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const isRegistered = await Location.hasStartedLocationUpdatesAsync(EMERGENCY_LOCATION_TASK_NAME);
  if (!isRegistered) {
    return;
  }

  await Location.stopLocationUpdatesAsync(EMERGENCY_LOCATION_TASK_NAME);
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

async function startNativeTrackingIfNeeded(): Promise<void> {
  await hydrateShares();

  if (activeBookingShares.size === 0) {
    await stopNativeTrackingIfIdle();
    return;
  }

  try {
    await ensureForegroundWatcher();
    await ensureTrackingTaskRegistered();
  } catch (error) {
    console.error('Unable to start emergency live location tracking', error);
  }
}

async function stopNativeTrackingIfIdle(): Promise<void> {
  await hydrateShares();

  if (activeBookingShares.size > 0) {
    return;
  }

  stopForegroundWatcher();
  await stopTrackingTask();
}

export interface EmergencyLocationPermissionResult {
  canShare: boolean;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}

export async function requestEmergencyLocationPermissions(): Promise<EmergencyLocationPermissionResult> {
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
    console.error('Unable to request emergency live location permissions', error);
    return {
      canShare: false,
      foregroundGranted: false,
      backgroundGranted: false,
    };
  }
}

export async function syncEmergencyLocationTracker(
  shares: EmergencyLiveLocationShare[],
): Promise<void> {
  await hydrateShares();

  const currentMs = nowMs();
  const next = new Map<string, number>();

  for (const share of shares) {
    if (!share || share.status !== 'active') {
      continue;
    }

    const bookingId = share.booking_id;
    const expiresAtMs = parseTimestamp(share.expires_at);

    if (!bookingId || !isFiniteTimestamp(expiresAtMs) || expiresAtMs <= currentMs) {
      continue;
    }

    next.set(bookingId, expiresAtMs);
  }

  activeBookingShares = next;
  await persistShares();

  if (activeBookingShares.size > 0) {
    await startNativeTrackingIfNeeded();
  } else {
    await stopNativeTrackingIfIdle();
  }
}

export async function addEmergencyShare(share: EmergencyLiveLocationShare): Promise<void> {
  if (!share || share.status !== 'active') {
    return;
  }

  await hydrateShares();

  const expiresAtMs = parseTimestamp(share.expires_at);
  if (!share.booking_id || !isFiniteTimestamp(expiresAtMs) || expiresAtMs <= nowMs()) {
    return;
  }

  activeBookingShares.set(share.booking_id, expiresAtMs);
  await persistShares();
  await startNativeTrackingIfNeeded();
}

export async function removeEmergencyShare(bookingId: string): Promise<void> {
  if (!bookingId) {
    return;
  }

  await hydrateShares();

  if (!activeBookingShares.has(bookingId)) {
    return;
  }

  activeBookingShares.delete(bookingId);
  await persistShares();
  await stopNativeTrackingIfIdle();
}

export async function publishEmergencyLocationSnapshot(): Promise<void> {
  await hydrateShares();

  if (activeBookingShares.size === 0) {
    return;
  }

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    await publishLocationSample(location.coords, location.timestamp);
  } catch (error) {
    console.error('Unable to publish emergency location snapshot', error);
  }
}

export async function clearEmergencyLocationTracker(): Promise<void> {
  activeBookingShares.clear();
  hasHydrated = true;

  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Unable to clear emergency live location tracker storage', error);
  }

  stopForegroundWatcher();
  try {
    await stopTrackingTask();
  } catch {
    // noop
  }
}

TaskManager.defineTask(EMERGENCY_LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Emergency live location background task error', error);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations || [];
  const latest = locations[locations.length - 1];

  if (!latest) {
    return;
  }

  await publishLocationSample(latest.coords, latest.timestamp);
});

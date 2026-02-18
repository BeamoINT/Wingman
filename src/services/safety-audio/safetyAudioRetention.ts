import type { SafetyAudioRecording } from '../../types';
import {
  deleteSafetyAudioFile,
  listSafetyAudioRecordings,
  removeMissingSafetyAudioFiles,
  removeSafetyAudioRecordingsByIds,
} from './safetyAudioStorage';

function parseTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isSafetyAudioRecordingExpired(
  recording: SafetyAudioRecording,
  referenceMs = Date.now(),
): boolean {
  const expiresAtMs = parseTimestamp(recording.expiresAt);
  return expiresAtMs > 0 && expiresAtMs <= referenceMs;
}

export async function cleanupSafetyAudioRetention(referenceMs = Date.now()): Promise<{
  deletedExpiredCount: number;
  removedMissingCount: number;
  remaining: SafetyAudioRecording[];
}> {
  const recordings = await listSafetyAudioRecordings();
  const expiredIds = recordings
    .filter((recording) => isSafetyAudioRecordingExpired(recording, referenceMs))
    .map((recording) => recording.id);

  let remaining = recordings;
  if (expiredIds.length > 0) {
    remaining = await removeSafetyAudioRecordingsByIds(expiredIds, { deleteFiles: true });
  }

  const reconciliation = await removeMissingSafetyAudioFiles();
  remaining = reconciliation.remaining;

  return {
    deletedExpiredCount: expiredIds.length,
    removedMissingCount: reconciliation.removedCount,
    remaining,
  };
}

export async function clearAllSafetyAudioRecordings(): Promise<void> {
  const recordings = await listSafetyAudioRecordings();
  await Promise.allSettled(recordings.map((recording) => deleteSafetyAudioFile(recording.uri)));
  await removeSafetyAudioRecordingsByIds(recordings.map((recording) => recording.id), { deleteFiles: false });
}


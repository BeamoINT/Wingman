import { Audio } from 'expo-av';
import { Linking } from 'react-native';

export interface SafetyAudioPermissionState {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
}

function normalizePermission(
  permission: Awaited<ReturnType<typeof Audio.getPermissionsAsync>>,
): SafetyAudioPermissionState {
  return {
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
    status: permission.granted
      ? 'granted'
      : permission.canAskAgain
      ? 'undetermined'
      : 'denied',
  };
}

export async function getSafetyAudioPermissionState(): Promise<SafetyAudioPermissionState> {
  try {
    const permission = await Audio.getPermissionsAsync();
    return normalizePermission(permission);
  } catch {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }
}

export async function requestSafetyAudioPermission(): Promise<SafetyAudioPermissionState> {
  try {
    const permission = await Audio.requestPermissionsAsync();
    return normalizePermission(permission);
  } catch {
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }
}

export async function openSafetyAudioSystemSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // no-op
  }
}


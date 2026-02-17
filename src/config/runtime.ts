import Constants from 'expo-constants';
import { Platform } from 'react-native';

const executionEnvironment = String(Constants.executionEnvironment || '').toLowerCase();
const appOwnership = String(Constants.appOwnership || '').toLowerCase();

export const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';
export type RuntimeMode = 'expo-go' | 'dev-client' | 'standalone' | 'web';

const resolveRuntimeMode = (): RuntimeMode => {
  if (Platform.OS === 'web') {
    return 'web';
  }

  if (executionEnvironment === 'storeclient' || appOwnership === 'expo') {
    return 'expo-go';
  }

  if (executionEnvironment === 'standalone' || appOwnership === 'standalone') {
    return 'standalone';
  }

  return 'dev-client';
};

export const runtimeMode: RuntimeMode = resolveRuntimeMode();
export const isExpoGo = runtimeMode === 'expo-go';
export const requiresNativeBuild = isNativeMobile && isExpoGo;
export const supportsNativeMediaCompression = isNativeMobile && !isExpoGo;
export const supportsSecureMessagingIdentity = isNativeMobile && !isExpoGo;
export const supportsRevenueCatPurchases = isNativeMobile && !isExpoGo;
export const supportsNativeMapboxMaps = isNativeMobile && !isExpoGo;

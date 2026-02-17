/**
 * Payments API Service
 * Handles subscription management links for store-managed IAP billing.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface BillingManagementResult {
  url: string | null;
  error: string | null;
}

function resolveAndroidPackageName(): string | null {
  const fromExpoConfig = Constants.expoConfig?.android?.package?.trim();
  if (fromExpoConfig) {
    return fromExpoConfig;
  }

  return null;
}

function getStoreSubscriptionManagementUrl(): string | null {
  if (Platform.OS === 'ios') {
    return 'https://apps.apple.com/account/subscriptions';
  }

  if (Platform.OS === 'android') {
    const packageName = resolveAndroidPackageName();
    if (packageName) {
      return `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(packageName)}`;
    }
    return 'https://play.google.com/store/account/subscriptions';
  }

  return null;
}

/**
 * Resolve the native store subscription management URL for the current device.
 */
export async function getBillingManagementLink(): Promise<BillingManagementResult> {
  const url = getStoreSubscriptionManagementUrl();
  if (url) {
    return { url, error: null };
  }

  return {
    url: null,
    error: 'Billing management is available in the iOS or Android app stores.',
  };
}

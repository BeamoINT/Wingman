import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { runtimeEnv } from '../../config/env';
import { isExpoGo, supportsRevenueCatPurchases } from '../../config/runtime';
import type { ProBillingPeriod } from '../../types';
import { safeLog } from '../../utils/sanitize';
import { supabase } from '../supabase';

export interface RevenueCatResult {
  success: boolean;
  error: string | null;
}

export interface ProEntitlementStatus {
  isPro: boolean;
  entitlementId: string;
  productId: string | null;
  expiresAt: string | null;
  store: string | null;
}

type PurchasesModuleType = typeof import('react-native-purchases');
type PurchasesPackageLike = {
  identifier?: string;
  packageType?: string;
};

let purchasesModulePromise: Promise<PurchasesModuleType | null> | null = null;

async function getPurchasesModule(): Promise<PurchasesModuleType | null> {
  if (!supportsRevenueCatPurchases || isExpoGo) {
    return null;
  }

  if (!purchasesModulePromise) {
    purchasesModulePromise = import('react-native-purchases')
      .then((module) => module)
      .catch(() => {
        return null;
      });
  }

  return purchasesModulePromise;
}

function getConfigValue(name: string): string {
  if (name === 'rc_api_key_ios') {
    return runtimeEnv.revenueCatApiKeyIos;
  }
  if (name === 'rc_api_key_android') {
    return runtimeEnv.revenueCatApiKeyAndroid;
  }
  if (name === 'rc_entitlement_pro') {
    return runtimeEnv.revenueCatEntitlementPro;
  }
  if (name === 'rc_package_pro_monthly') {
    return runtimeEnv.revenueCatPackageProMonthly;
  }
  if (name === 'rc_package_pro_yearly') {
    return runtimeEnv.revenueCatPackageProYearly;
  }

  const extra = (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
  const fromExtra = extra[name];
  if (typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
    return fromExtra.trim();
  }

  const envKey = `EXPO_PUBLIC_${name.toUpperCase()}`;
  const fromEnv = process.env[envKey];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  return '';
}

function getApiKey(): string {
  if (Platform.OS === 'ios') {
    return getConfigValue('rc_api_key_ios');
  }
  if (Platform.OS === 'android') {
    return getConfigValue('rc_api_key_android');
  }
  return '';
}

function getProEntitlementId(): string {
  return getConfigValue('rc_entitlement_pro') || 'pro';
}

function getProMonthlyPackageId(): string {
  return getConfigValue('rc_package_pro_monthly') || '$rc_monthly';
}

function getProYearlyPackageId(): string {
  return getConfigValue('rc_package_pro_yearly') || '$rc_annual';
}

function normalizeExpirationDate(
  customerInfo: {
    entitlements: { active: Record<string, { expirationDate?: string | null }> };
  },
  entitlementId: string
): string | null {
  const entitlement = customerInfo.entitlements.active[entitlementId];
  if (!entitlement) return null;

  const expirationDate = entitlement.expirationDate;
  if (!expirationDate) return null;

  const parsed = Date.parse(expirationDate);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

let initializedForUser: string | null = null;

async function syncWithBackend(): Promise<void> {
  try {
    await supabase.functions.invoke('sync-pro-entitlement');
  } catch (error: unknown) {
    safeLog('Failed to sync Pro entitlement with backend', { error: String(error) });
  }
}

function ensureMobileRuntime(): RevenueCatResult | null {
  if (Platform.OS === 'web') {
    return {
      success: false,
      error: 'Subscriptions can only be managed in the iOS or Android app.',
    };
  }
  if (isExpoGo || !supportsRevenueCatPurchases) {
    return {
      success: false,
      error: 'Subscriptions require the Wingman app build. Expo Go is unsupported.',
    };
  }
  return null;
}

export async function initRevenueCat(userId: string): Promise<RevenueCatResult> {
  const runtimeError = ensureMobileRuntime();
  if (runtimeError) return runtimeError;

  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'RevenueCat API key is not configured.',
    };
  }

  if (!userId?.trim()) {
    return {
      success: false,
      error: 'Cannot initialize subscriptions without a valid user.',
    };
  }

  try {
    const purchasesModule = await getPurchasesModule();
    if (!purchasesModule) {
      return {
        success: false,
        error: 'Subscriptions are unavailable in this runtime.',
      };
    }

    const Purchases = purchasesModule.default;
    const { LOG_LEVEL } = purchasesModule;

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

    if (!initializedForUser) {
      await Purchases.configure({ apiKey, appUserID: userId });
      initializedForUser = userId;
      return { success: true, error: null };
    }

    if (initializedForUser !== userId) {
      await Purchases.logIn(userId);
      initializedForUser = userId;
    }

    return { success: true, error: null };
  } catch (error) {
    safeLog('Failed to initialize RevenueCat', { error: String(error) });
    return {
      success: false,
      error: 'Unable to initialize subscriptions right now.',
    };
  }
}

function resolveProPackage(
  availablePackages: PurchasesPackageLike[],
  billingPeriod: ProBillingPeriod
): PurchasesPackageLike | null {
  const configuredPackageId = billingPeriod === 'yearly'
    ? getProYearlyPackageId()
    : getProMonthlyPackageId();
  const fallbackPackageType = billingPeriod === 'yearly' ? 'ANNUAL' : 'MONTHLY';

  const exactMatch = availablePackages.find((pkg) => pkg.identifier === configuredPackageId);
  if (exactMatch) return exactMatch;

  const matchingPeriodPackage = availablePackages.find((pkg) => (
    String(pkg.packageType || '').toUpperCase() === fallbackPackageType
  ));
  if (matchingPeriodPackage) return matchingPeriodPackage;

  if (billingPeriod === 'monthly') {
    return availablePackages[0] || null;
  }

  return null;
}

export async function purchaseProPlan(billingPeriod: ProBillingPeriod): Promise<RevenueCatResult> {
  const runtimeError = ensureMobileRuntime();
  if (runtimeError) return runtimeError;

  try {
    const purchasesModule = await getPurchasesModule();
    if (!purchasesModule) {
      return {
        success: false,
        error: 'Subscriptions are unavailable in this runtime.',
      };
    }

    const Purchases = purchasesModule.default;
    const offerings = await Purchases.getOfferings();
    const allPackages = offerings.current?.availablePackages || [];
    const selectedPackage = resolveProPackage(allPackages, billingPeriod);

    if (!selectedPackage) {
      const periodLabel = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
      return {
        success: false,
        error: `No Pro ${periodLabel} package is available right now.`,
      };
    }

    await Purchases.purchasePackage(selectedPackage as any);
    await syncWithBackend();
    return { success: true, error: null };
  } catch (error) {
    const message = String(error || '').toLowerCase();
    if (message.includes('cancel')) {
      return { success: false, error: 'Purchase was canceled.' };
    }
    safeLog(`Failed to purchase Pro ${billingPeriod} subscription`, { error: String(error) });
    return {
      success: false,
      error: `Unable to complete your Pro ${billingPeriod} purchase right now.`,
    };
  }
}

export async function purchaseProMonthly(): Promise<RevenueCatResult> {
  return purchaseProPlan('monthly');
}

export async function restorePurchases(): Promise<RevenueCatResult> {
  const runtimeError = ensureMobileRuntime();
  if (runtimeError) return runtimeError;

  try {
    const purchasesModule = await getPurchasesModule();
    if (!purchasesModule) {
      return {
        success: false,
        error: 'Subscriptions are unavailable in this runtime.',
      };
    }

    const Purchases = purchasesModule.default;
    await Purchases.restorePurchases();
    await syncWithBackend();
    return { success: true, error: null };
  } catch (error: unknown) {
    safeLog('Failed to restore purchases', { error: String(error) });
    return { success: false, error: 'Unable to restore purchases right now.' };
  }
}

export async function getEntitlementStatus(): Promise<{
  status: ProEntitlementStatus;
  error: string | null;
}> {
  const entitlementId = getProEntitlementId();

  if (Platform.OS === 'web') {
    return {
      status: {
        isPro: false,
        entitlementId,
        productId: null,
        expiresAt: null,
        store: null,
      },
      error: 'Subscriptions are only available in the mobile app.',
    };
  }

  try {
    const purchasesModule = await getPurchasesModule();
    if (!purchasesModule) {
      return {
        status: {
          isPro: false,
          entitlementId,
          productId: null,
          expiresAt: null,
          store: null,
        },
        error: 'Subscriptions are unavailable in this runtime.',
      };
    }

    const Purchases = purchasesModule.default;
    const customerInfo = await Purchases.getCustomerInfo();
    const activeEntitlement = customerInfo.entitlements.active[entitlementId];
    const isPro = !!activeEntitlement;
    const productId = activeEntitlement?.productIdentifier || null;

    return {
      status: {
        isPro,
        entitlementId,
        productId,
        expiresAt: normalizeExpirationDate(customerInfo, entitlementId),
        store: (activeEntitlement as { store?: string } | undefined)?.store || null,
      },
      error: null,
    };
  } catch (error: unknown) {
    safeLog('Failed to fetch RevenueCat entitlement status', { error: String(error) });
    return {
      status: {
        isPro: false,
        entitlementId,
        productId: null,
        expiresAt: null,
        store: null,
      },
      error: 'Unable to fetch subscription status right now.',
    };
  }
}

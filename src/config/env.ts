import Constants from 'expo-constants';

type AppEnv = 'development' | 'staging' | 'production';

type EnvShape = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appEnv: AppEnv;
  stripePublishableKey: string;
  revenueCatApiKeyIos: string;
  revenueCatApiKeyAndroid: string;
  revenueCatEntitlementPro: string;
  revenueCatPackageProMonthly: string;
  revenueCatPackageProYearly: string;
  mapboxAccessToken: string;
  sentryDsn: string;
};

function readRawValue(key: string): string {
  const extra = (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
  const fromExtra = extra[key];
  if (typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
    return fromExtra.trim();
  }

  const envKey = `EXPO_PUBLIC_${key.toUpperCase()}`;
  const fromEnv = process.env[envKey];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  return '';
}

function toAppEnv(value: string): AppEnv {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'production') return 'production';
  if (normalized === 'staging') return 'staging';
  return 'development';
}

function warnMissing(name: string): void {
  if (__DEV__) {
    console.warn(`Missing required runtime env: ${name}`);
  }
}

function loadEnv(): EnvShape {
  const supabaseUrl = readRawValue('supabase_url');
  const supabaseAnonKey = readRawValue('supabase_anon_key');
  const stripePublishableKey = readRawValue('stripe_publishable_key');
  const appEnv = toAppEnv(readRawValue('app_env') || 'development');
  const revenueCatApiKeyIos = readRawValue('rc_api_key_ios');
  const revenueCatApiKeyAndroid = readRawValue('rc_api_key_android');
  const revenueCatEntitlementPro = readRawValue('rc_entitlement_pro') || 'pro';
  const revenueCatPackageProMonthly = readRawValue('rc_package_pro_monthly') || '$rc_monthly';
  const revenueCatPackageProYearly = readRawValue('rc_package_pro_yearly') || '$rc_annual';
  const mapboxAccessToken = readRawValue('mapbox_access_token');
  const sentryDsn = readRawValue('sentry_dsn');

  if (!supabaseUrl) warnMissing('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) warnMissing('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  return {
    supabaseUrl,
    supabaseAnonKey,
    appEnv,
    stripePublishableKey,
    revenueCatApiKeyIos,
    revenueCatApiKeyAndroid,
    revenueCatEntitlementPro,
    revenueCatPackageProMonthly,
    revenueCatPackageProYearly,
    mapboxAccessToken,
    sentryDsn,
  };
}

export const runtimeEnv = loadEnv();

export function assertCoreEnvInDevelopment(): void {
  if (!__DEV__) {
    return;
  }

  const missing: string[] = [];
  if (!runtimeEnv.supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!runtimeEnv.supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

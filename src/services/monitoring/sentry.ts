import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { runtimeEnv } from '../../config/env';

let sentryInitialized = false;

const SENSITIVE_LOCATION_KEYS = new Set([
  'city',
  'state',
  'country',
  'countrycode',
  'coordinates',
  'latitude',
  'longitude',
  'location',
  'formattedaddress',
  'address',
]);

function redactSensitiveLocationData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveLocationData(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const source = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  Object.entries(source).forEach(([key, entryValue]) => {
    const normalizedKey = key.trim().toLowerCase();
    if (SENSITIVE_LOCATION_KEYS.has(normalizedKey)) {
      sanitized[key] = '[redacted]';
      return;
    }

    sanitized[key] = redactSensitiveLocationData(entryValue);
  });

  return sanitized;
}

export function initializeSentry(): void {
  if (sentryInitialized) {
    return;
  }

  const dsn = runtimeEnv.sentryDsn;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    enabled: !__DEV__,
    environment: runtimeEnv.appEnv,
    release: `wingman@${Constants.expoConfig?.version || 'dev'}`,
    tracesSampleRate: runtimeEnv.appEnv === 'production' ? 0.15 : 1.0,
    beforeBreadcrumb: (breadcrumb) => {
      const safeData = redactSensitiveLocationData(breadcrumb.data || {}) as Record<string, unknown>;
      return {
        ...breadcrumb,
        data: safeData,
      };
    },
    beforeSend: (event) => {
      const safeContexts = redactSensitiveLocationData(event.contexts || {}) as Sentry.ErrorEvent['contexts'];
      const safeEvent: Sentry.ErrorEvent = {
        ...event,
        extra: redactSensitiveLocationData(event.extra || {}) as Record<string, unknown>,
        contexts: safeContexts,
      };
      return safeEvent;
    },
  });

  sentryInitialized = true;
}

export function reportNavigationRoute(routeName: string): void {
  if (!routeName) {
    return;
  }

  Sentry.setTag('navigation.route', routeName);
  Sentry.addBreadcrumb({
    category: 'navigation',
    level: 'info',
    message: routeName,
  });
}

export function captureError(error: unknown): void {
  if (error instanceof Error) {
    Sentry.captureException(error);
    return;
  }

  Sentry.captureMessage(String(error));
}

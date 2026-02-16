import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { runtimeEnv } from '../../config/env';

let sentryInitialized = false;

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


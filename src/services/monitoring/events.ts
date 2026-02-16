import * as Sentry from '@sentry/react-native';

export type MonitoringEventName =
  | 'auth_signin_success'
  | 'auth_signin_fail'
  | 'booking_create_success'
  | 'booking_create_fail'
  | 'message_send_success'
  | 'message_send_fail'
  | 'pro_purchase_started'
  | 'pro_purchase_succeeded'
  | 'pro_purchase_failed'
  | 'pro_restore_succeeded'
  | 'pro_restore_failed';

type EventPayload = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(name: MonitoringEventName, payload: EventPayload = {}): void {
  if (__DEV__) {
    console.log(`[event] ${name}`, payload);
  }

  Sentry.addBreadcrumb({
    category: 'product.event',
    level: 'info',
    message: name,
    data: payload,
  });
}


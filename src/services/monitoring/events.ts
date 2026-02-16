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
  | 'pro_restore_failed'
  | 'metro_resolve_success'
  | 'metro_resolve_failed'
  | 'location_data_blocked_read'
  | 'location_policy_denied';

type EventPayload = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(name: MonitoringEventName, payload: EventPayload = {}): void {
  Sentry.addBreadcrumb({
    category: 'product.event',
    level: 'info',
    message: name,
    data: payload,
  });
}

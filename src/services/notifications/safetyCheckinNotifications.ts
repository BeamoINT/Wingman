import * as Notifications from 'expo-notifications';

const SAFETY_CHECKIN_CATEGORY_ID = 'SAFETY_CHECKIN_CATEGORY_V1';

export const SAFETY_CHECKIN_ACTION_SAFE = 'SAFETY_CHECKIN_ACTION_SAFE';
export const SAFETY_CHECKIN_ACTION_UNSAFE = 'SAFETY_CHECKIN_ACTION_UNSAFE';

let configured = false;

export function isSafetyCheckinNotificationData(value: unknown): value is {
  type: 'safety_checkin';
  checkinId: string;
  bookingId?: string;
  respondBy?: string;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Record<string, unknown>;
  return data.type === 'safety_checkin' && typeof data.checkinId === 'string' && data.checkinId.trim().length > 0;
}

export function isSafetySessionReminderData(value: unknown): value is {
  type: 'safety_checkin_reminder';
  sessionId: string;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Record<string, unknown>;
  return data.type === 'safety_checkin_reminder' && typeof data.sessionId === 'string' && data.sessionId.trim().length > 0;
}

export async function configureSafetyCheckinNotifications(): Promise<void> {
  if (configured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await Notifications.setNotificationCategoryAsync(SAFETY_CHECKIN_CATEGORY_ID, [
    {
      identifier: SAFETY_CHECKIN_ACTION_SAFE,
      buttonTitle: "I'm Safe",
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: SAFETY_CHECKIN_ACTION_UNSAFE,
      buttonTitle: 'Not Safe',
      options: {
        isDestructive: true,
        opensAppToForeground: true,
      },
    },
  ]);

  configured = true;
}

export async function ensureSafetyCheckinNotificationPermissions(): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status === 'granted') {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: false,
    },
  });

  return requested.status === 'granted';
}

export async function scheduleSafetyCheckinNotification(params: {
  checkinId: string;
  bookingId?: string;
  respondBy?: string | null;
}): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Safety Check-In',
      body: params.respondBy
        ? `Please confirm you are safe before ${new Date(params.respondBy).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
        : 'Are you feeling safe? Please confirm in Wingman.',
      sound: 'default',
      categoryIdentifier: SAFETY_CHECKIN_CATEGORY_ID,
      data: {
        type: 'safety_checkin',
        checkinId: params.checkinId,
        bookingId: params.bookingId,
        respondBy: params.respondBy || undefined,
      },
    },
    trigger: null,
  });
}

export async function scheduleSafetySessionReminder(params: {
  sessionId: string;
  bookingId?: string;
  intervalMinutes: number;
}): Promise<string> {
  const safeSeconds = Math.max(5 * 60, Math.min(3 * 60 * 60, Math.round(params.intervalMinutes * 60)));

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Safety Reminder',
      body: 'Are you feeling safe? Open Wingman to check in.',
      sound: 'default',
      data: {
        type: 'safety_checkin_reminder',
        sessionId: params.sessionId,
        bookingId: params.bookingId,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: safeSeconds,
      repeats: true,
    },
  });
}

export async function dismissSafetyCheckinNotification(notificationId: string): Promise<void> {
  if (!notificationId) {
    return;
  }

  await Notifications.dismissNotificationAsync(notificationId);
}

export async function cancelScheduledSafetyReminder(notificationId: string): Promise<void> {
  if (!notificationId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function dismissAllSafetyCheckinNotifications(): Promise<void> {
  const notifications = await Notifications.getPresentedNotificationsAsync();
  const safetyIds = notifications
    .filter((notification) => isSafetyCheckinNotificationData(notification.request.content.data))
    .map((notification) => notification.request.identifier)
    .filter((value) => typeof value === 'string' && value.trim().length > 0);

  await Promise.allSettled(safetyIds.map((id) => Notifications.dismissNotificationAsync(id)));

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const reminderIds = scheduled
    .filter((entry) => isSafetySessionReminderData(entry.content.data))
    .map((entry) => entry.identifier)
    .filter((value) => typeof value === 'string' && value.trim().length > 0);

  await Promise.allSettled(reminderIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

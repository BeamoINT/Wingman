import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Notifications from 'expo-notifications';
import type { EmergencyContactRecord } from '../services/api/emergencyContactsApi';
import {
  listEmergencyContacts,
} from '../services/api/emergencyContactsApi';
import {
  type EmergencyLiveLocationShare,
  extendEmergencyLiveLocationShare,
  listMyEmergencyLiveLocationShares,
  startEmergencyLiveLocationShare,
  stopEmergencyLiveLocationShare,
} from '../services/api/emergencyLiveLocationApi';
import {
  type SafetyAcknowledgementState,
  type SafetyPreferences,
  type SafetySessionSummary,
  acknowledgeSafetyDisclaimer,
  getSafetyAcknowledgement,
  getSafetyPreferences,
  listMyActiveSafetySessions,
  respondToSafetyCheckin,
  triggerEmergencyAlert,
  updateSafetyPreferences,
} from '../services/api/safetyApi';
import { trackEvent } from '../services/monitoring/events';
import {
  addEmergencyShare,
  clearEmergencyLocationTracker,
  publishEmergencyLocationSnapshot,
  removeEmergencyShare,
  requestEmergencyLocationPermissions,
  syncEmergencyLocationTracker,
} from '../services/location/emergencyLocationTracker';
import {
  SAFETY_CHECKIN_ACTION_SAFE,
  SAFETY_CHECKIN_ACTION_UNSAFE,
  cancelScheduledSafetyReminder,
  configureSafetyCheckinNotifications,
  dismissAllSafetyCheckinNotifications,
  dismissSafetyCheckinNotification,
  ensureSafetyCheckinNotificationPermissions,
  isSafetyCheckinNotificationData,
  scheduleSafetySessionReminder,
  scheduleSafetyCheckinNotification,
} from '../services/notifications/safetyCheckinNotifications';
import { useAuth } from './AuthContext';

const REFRESH_INTERVAL_MS = 30_000;

interface SafetyContextType {
  isLoading: boolean;
  contacts: EmergencyContactRecord[];
  preferences: SafetyPreferences | null;
  safetyAcknowledgement: SafetyAcknowledgementState | null;
  hasAcknowledgedSafetyDisclaimer: boolean;
  sessions: SafetySessionSummary[];
  emergencyShares: EmergencyLiveLocationShare[];
  hasActiveSafetySession: boolean;
  pendingCheckin: SafetySessionSummary | null;
  refreshSafetyState: () => Promise<void>;
  refreshContacts: () => Promise<void>;
  updatePreferences: (input: {
    checkinsEnabled?: boolean;
    checkinIntervalMinutes?: number;
    checkinResponseWindowMinutes?: number;
    sosEnabled?: boolean;
    autoShareLiveLocation?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  acknowledgeSafetyDisclaimer: () => Promise<{ success: boolean; error?: string }>;
  respondCheckin: (checkinId: string, response: 'safe' | 'unsafe') => Promise<{ success: boolean; error?: string }>;
  triggerSos: (params: {
    bookingId?: string;
    location?: {
      latitude?: number;
      longitude?: number;
      accuracyM?: number;
      capturedAt?: string;
    };
    includeLiveLocationLink?: boolean;
    source?: 'sos_button' | 'checkin_unsafe' | 'checkin_timeout' | 'live_location_started' | 'manual';
  }) => Promise<{ success: boolean; sentCount: number; failedCount: number; emergencyDialNumber: string; error?: string }>;
  startEmergencyShare: (bookingId: string, durationMinutes?: number) => Promise<{ success: boolean; error?: string }>;
  stopEmergencyShare: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  extendEmergencyShare: (bookingId: string, extensionMinutes?: number) => Promise<{ success: boolean; error?: string }>;
  isEmergencyShareActive: (bookingId: string) => boolean;
}

const SafetyContext = createContext<SafetyContextType | undefined>(undefined);

function normalizeActiveShares(shares: EmergencyLiveLocationShare[]): EmergencyLiveLocationShare[] {
  const nowIso = new Date().toISOString();
  return shares
    .filter((share) => share.status === 'active' && share.expires_at > nowIso)
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());
}

export const SafetyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContactRecord[]>([]);
  const [preferences, setPreferences] = useState<SafetyPreferences | null>(null);
  const [safetyAcknowledgement, setSafetyAcknowledgement] = useState<SafetyAcknowledgementState | null>(null);
  const [sessions, setSessions] = useState<SafetySessionSummary[]>([]);
  const [emergencyShares, setEmergencyShares] = useState<EmergencyLiveLocationShare[]>([]);
  const notificationIdByCheckinRef = useRef<Map<string, string>>(new Map());
  const announcedCheckinsRef = useRef<Set<string>>(new Set());
  const reminderIdBySessionRef = useRef<Map<string, { notificationId: string; intervalMinutes: number }>>(new Map());

  const refreshContacts = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setContacts([]);
      return;
    }

    const { contacts: rows, error } = await listEmergencyContacts();
    if (error) {
      console.error('Unable to refresh emergency contacts', error);
      return;
    }

    setContacts(rows);
  }, [isAuthenticated, user?.id]);

  const refreshSafetyState = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setContacts([]);
      setPreferences(null);
      setSafetyAcknowledgement(null);
      setSessions([]);
      setEmergencyShares([]);
      return;
    }

    const [contactsResult, preferencesResult, acknowledgementResult, sessionsResult, sharesResult] = await Promise.all([
      listEmergencyContacts(),
      getSafetyPreferences(),
      getSafetyAcknowledgement(),
      listMyActiveSafetySessions(),
      listMyEmergencyLiveLocationShares(),
    ]);

    if (!contactsResult.error) {
      setContacts(contactsResult.contacts);
    }

    if (!preferencesResult.error) {
      setPreferences(preferencesResult.preferences);
    }

    if (!acknowledgementResult.error) {
      setSafetyAcknowledgement(acknowledgementResult.acknowledgement);
    }

    if (!sessionsResult.error) {
      setSessions(sessionsResult.sessions);
    }

    if (!sharesResult.error) {
      const normalizedShares = normalizeActiveShares(sharesResult.shares);
      setEmergencyShares(normalizedShares);
      await syncEmergencyLocationTracker(normalizedShares);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setContacts([]);
      setPreferences(null);
      setSafetyAcknowledgement(null);
      setSessions([]);
      setEmergencyShares([]);
      void clearEmergencyLocationTracker();
      return;
    }

    setIsLoading(true);
    void refreshSafetyState().finally(() => {
      setIsLoading(false);
    });

    const interval = setInterval(() => {
      void refreshSafetyState();
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, refreshSafetyState, user?.id]);

  const updatePreferencesHandler = useCallback(async (input: {
    checkinsEnabled?: boolean;
    checkinIntervalMinutes?: number;
    checkinResponseWindowMinutes?: number;
    sosEnabled?: boolean;
    autoShareLiveLocation?: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    const { preferences: nextPreferences, error } = await updateSafetyPreferences(input);

    if (error || !nextPreferences) {
      return {
        success: false,
        error: error?.message || 'Unable to update safety settings.',
      };
    }

    setPreferences(nextPreferences);
    return { success: true };
  }, []);

  const acknowledgeSafetyDisclaimerHandler = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const { acknowledged, error } = await acknowledgeSafetyDisclaimer('2026-03-03');
    if (!acknowledged || error) {
      return {
        success: false,
        error: error?.message || 'Unable to save acknowledgement.',
      };
    }

    const { acknowledgement } = await getSafetyAcknowledgement();
    if (acknowledgement) {
      setSafetyAcknowledgement(acknowledgement);
    }

    return { success: true };
  }, []);

  const respondCheckin = useCallback(async (
    checkinId: string,
    response: 'safe' | 'unsafe',
  ): Promise<{ success: boolean; error?: string }> => {
    const { success, error } = await respondToSafetyCheckin(checkinId, response);

    if (!success || error) {
      return {
        success: false,
        error: error?.message || 'Unable to submit your check-in response.',
      };
    }

    if (response === 'unsafe') {
      trackEvent('safety_checkin_unsafe_selected');
    } else {
      trackEvent('safety_checkin_safe_selected');
    }

    await refreshSafetyState();

    return { success: true };
  }, [refreshSafetyState]);

  const triggerSos = useCallback(async (params: {
    bookingId?: string;
    location?: {
      latitude?: number;
      longitude?: number;
      accuracyM?: number;
      capturedAt?: string;
    };
    includeLiveLocationLink?: boolean;
    source?: 'sos_button' | 'checkin_unsafe' | 'checkin_timeout' | 'live_location_started' | 'manual';
  }): Promise<{ success: boolean; sentCount: number; failedCount: number; emergencyDialNumber: string; error?: string }> => {
    const { success, sentCount, failedCount, emergencyDialNumber, error } = await triggerEmergencyAlert({
      bookingId: params.bookingId,
      source: params.source || 'sos_button',
      includeLiveLocationLink: params.includeLiveLocationLink,
      location: params.location,
    });

    if (!success || error) {
      trackEvent('safety_sos_trigger_failed', {
        sentCount,
        failedCount,
      });

      return {
        success: false,
        sentCount,
        failedCount,
        emergencyDialNumber,
        error: error?.message || 'Unable to trigger SOS alert.',
      };
    }

    trackEvent('safety_sos_triggered', {
      sentCount,
      failedCount,
    });

    return {
      success: true,
      sentCount,
      failedCount,
      emergencyDialNumber,
    };
  }, []);

  const startEmergencyShare = useCallback(async (
    bookingId: string,
    durationMinutes = 120,
  ): Promise<{ success: boolean; error?: string }> => {
    const permissions = await requestEmergencyLocationPermissions();
    if (!permissions.canShare) {
      trackEvent('live_location_permission_denied', {
        scope: 'safety',
      });
      return {
        success: false,
        error: 'Location permission is required to share emergency live location.',
      };
    }

    const { share, error } = await startEmergencyLiveLocationShare(bookingId, durationMinutes);

    if (error || !share) {
      return {
        success: false,
        error: error?.message || 'Unable to start emergency live location sharing.',
      };
    }

    await addEmergencyShare(share);
    await publishEmergencyLocationSnapshot();

    setEmergencyShares((prev) => normalizeActiveShares([
      ...prev.filter((item) => item.booking_id !== share.booking_id),
      share,
    ]));

    const { success: alertSuccess } = await triggerSos({
      bookingId,
      includeLiveLocationLink: true,
      source: 'live_location_started',
    });

    trackEvent('live_location_share_started', {
      source: 'emergency_contacts',
      alertSent: alertSuccess,
    });

    return { success: true };
  }, [triggerSos]);

  const stopEmergencyShare = useCallback(async (bookingId: string): Promise<{ success: boolean; error?: string }> => {
    const { success, error } = await stopEmergencyLiveLocationShare(bookingId);

    if (!success || error) {
      return {
        success: false,
        error: error?.message || 'Unable to stop emergency live location sharing.',
      };
    }

    await removeEmergencyShare(bookingId);
    setEmergencyShares((prev) => prev.filter((item) => item.booking_id !== bookingId));

    trackEvent('live_location_share_stopped', {
      source: 'emergency_contacts',
    });

    return { success: true };
  }, []);

  const extendEmergencyShare = useCallback(async (
    bookingId: string,
    extensionMinutes = 30,
  ): Promise<{ success: boolean; error?: string }> => {
    const { share, error } = await extendEmergencyLiveLocationShare(bookingId, extensionMinutes);

    if (error || !share) {
      return {
        success: false,
        error: error?.message || 'Unable to extend emergency live location sharing.',
      };
    }

    await addEmergencyShare(share);
    setEmergencyShares((prev) => normalizeActiveShares([
      ...prev.filter((item) => item.booking_id !== share.booking_id),
      share,
    ]));

    return { success: true };
  }, []);

  const isEmergencyShareActive = useCallback((bookingId: string): boolean => {
    if (!bookingId) {
      return false;
    }

    const nowIso = new Date().toISOString();
    return emergencyShares.some((share) => share.booking_id === bookingId && share.status === 'active' && share.expires_at > nowIso);
  }, [emergencyShares]);

  const pendingCheckin = useMemo(() => {
    return sessions.find((session) => !!session.pending_checkin_id) || null;
  }, [sessions]);

  const hasActiveSafetySession = useMemo(() => sessions.some((session) => session.status === 'active'), [sessions]);
  const hasAcknowledgedSafetyDisclaimer = useMemo(
    () => safetyAcknowledgement?.has_acknowledged === true,
    [safetyAcknowledgement],
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      announcedCheckinsRef.current.clear();
      notificationIdByCheckinRef.current.clear();
      reminderIdBySessionRef.current.clear();
      void dismissAllSafetyCheckinNotifications();
      return;
    }

    void (async () => {
      try {
        await configureSafetyCheckinNotifications();
        await ensureSafetyCheckinNotificationPermissions();
      } catch (error) {
        console.error('Unable to configure safety check-in notifications', error);
      }
    })();
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return undefined;
    }

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!isSafetyCheckinNotificationData(data)) {
        return;
      }

      const actionId = response.actionIdentifier;
      if (actionId !== SAFETY_CHECKIN_ACTION_SAFE && actionId !== SAFETY_CHECKIN_ACTION_UNSAFE) {
        return;
      }

      void (async () => {
        const checkinId = data.checkinId;
        if (!checkinId) {
          return;
        }

        const mappedResponse = actionId === SAFETY_CHECKIN_ACTION_UNSAFE ? 'unsafe' : 'safe';
        const result = await respondCheckin(checkinId, mappedResponse);
        if (!result.success) {
          return;
        }

        announcedCheckinsRef.current.delete(checkinId);
        const notificationId = notificationIdByCheckinRef.current.get(checkinId);
        if (notificationId) {
          await dismissSafetyCheckinNotification(notificationId);
          notificationIdByCheckinRef.current.delete(checkinId);
        }

        if (mappedResponse === 'unsafe') {
          await triggerSos({
            bookingId: data.bookingId,
            source: 'checkin_unsafe',
          });
        }

        await refreshSafetyState();
      })();
    });

    return () => {
      responseListener.remove();
    };
  }, [isAuthenticated, refreshSafetyState, respondCheckin, triggerSos, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    const pendingItems = sessions
      .filter((session) => typeof session.pending_checkin_id === 'string' && session.pending_checkin_id.trim().length > 0)
      .map((session) => ({
        checkinId: session.pending_checkin_id as string,
        bookingId: session.booking_id,
        respondBy: session.pending_checkin_respond_by,
      }));

    const activeCheckinIds = new Set(pendingItems.map((item) => item.checkinId));

    for (const [checkinId, notificationId] of notificationIdByCheckinRef.current.entries()) {
      if (activeCheckinIds.has(checkinId)) {
        continue;
      }

      void dismissSafetyCheckinNotification(notificationId);
      notificationIdByCheckinRef.current.delete(checkinId);
      announcedCheckinsRef.current.delete(checkinId);
    }

    for (const item of pendingItems) {
      if (announcedCheckinsRef.current.has(item.checkinId)) {
        continue;
      }

      announcedCheckinsRef.current.add(item.checkinId);
      void (async () => {
        try {
          const granted = await ensureSafetyCheckinNotificationPermissions();
          if (!granted) {
            announcedCheckinsRef.current.delete(item.checkinId);
            return;
          }

          const notificationId = await scheduleSafetyCheckinNotification({
            checkinId: item.checkinId,
            bookingId: item.bookingId,
            respondBy: item.respondBy,
          });
          notificationIdByCheckinRef.current.set(item.checkinId, notificationId);
        } catch (error) {
          announcedCheckinsRef.current.delete(item.checkinId);
          console.error('Unable to schedule safety check-in notification', error);
        }
      })();
    }
  }, [isAuthenticated, sessions, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    const activeSessions = sessions.filter((session) => session.status === 'active');
    const activeSessionIds = new Set(activeSessions.map((session) => session.session_id));

    for (const [sessionId, reminder] of reminderIdBySessionRef.current.entries()) {
      if (activeSessionIds.has(sessionId)) {
        continue;
      }

      void cancelScheduledSafetyReminder(reminder.notificationId);
      reminderIdBySessionRef.current.delete(sessionId);
    }

    for (const session of activeSessions) {
      const intervalMinutes = Math.max(5, Math.round(session.checkin_interval_minutes || 30));
      const existingReminder = reminderIdBySessionRef.current.get(session.session_id);
      if (existingReminder && existingReminder.intervalMinutes === intervalMinutes) {
        continue;
      }

      if (existingReminder) {
        void cancelScheduledSafetyReminder(existingReminder.notificationId);
        reminderIdBySessionRef.current.delete(session.session_id);
      }

      reminderIdBySessionRef.current.set(session.session_id, {
        notificationId: '',
        intervalMinutes,
      });

      void (async () => {
        try {
          const granted = await ensureSafetyCheckinNotificationPermissions();
          if (!granted) {
            return;
          }

          const notificationId = await scheduleSafetySessionReminder({
            sessionId: session.session_id,
            bookingId: session.booking_id,
            intervalMinutes,
          });
          reminderIdBySessionRef.current.set(session.session_id, {
            notificationId,
            intervalMinutes,
          });
        } catch (error) {
          reminderIdBySessionRef.current.delete(session.session_id);
          console.error('Unable to schedule safety session reminders', error);
        }
      })();
    }
  }, [isAuthenticated, sessions, user?.id]);

  const value = useMemo<SafetyContextType>(() => ({
    isLoading,
    contacts,
    preferences,
    safetyAcknowledgement,
    hasAcknowledgedSafetyDisclaimer,
    sessions,
    emergencyShares,
    hasActiveSafetySession,
    pendingCheckin,
    refreshSafetyState,
    refreshContacts,
    updatePreferences: updatePreferencesHandler,
    acknowledgeSafetyDisclaimer: acknowledgeSafetyDisclaimerHandler,
    respondCheckin,
    triggerSos,
    startEmergencyShare,
    stopEmergencyShare,
    extendEmergencyShare,
    isEmergencyShareActive,
  }), [
    contacts,
    emergencyShares,
    hasAcknowledgedSafetyDisclaimer,
    hasActiveSafetySession,
    isEmergencyShareActive,
    isLoading,
    pendingCheckin,
    preferences,
    safetyAcknowledgement,
    refreshContacts,
    refreshSafetyState,
    respondCheckin,
    sessions,
    startEmergencyShare,
    stopEmergencyShare,
    extendEmergencyShare,
    triggerSos,
    acknowledgeSafetyDisclaimerHandler,
    updatePreferencesHandler,
  ]);

  return (
    <SafetyContext.Provider value={value}>
      {children}
    </SafetyContext.Provider>
  );
};

export function useSafety(): SafetyContextType {
  const context = useContext(SafetyContext);
  if (!context) {
    throw new Error('useSafety must be used within a SafetyProvider');
  }

  return context;
}

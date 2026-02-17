import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { LiveLocationShareSession } from '../types/location';
import {
  listMyActiveLiveLocationShares,
  startLiveLocationShare,
  stopLiveLocationShare,
} from '../services/api/liveLocationApi';
import {
  addLiveLocationShareSession,
  clearLiveLocationTracker,
  publishCurrentLocationSnapshot,
  removeLiveLocationShareSession,
  requestLiveLocationPermissions,
  syncLiveLocationTracker,
} from '../services/location/liveLocationTracker';
import { trackEvent } from '../services/monitoring/events';
import { useAuth } from './AuthContext';

const REFRESH_INTERVAL_MS = 30_000;

interface LiveLocationContextType {
  isLoading: boolean;
  activeShares: LiveLocationShareSession[];
  nowMs: number;
  refreshActiveShares: () => Promise<void>;
  startShare: (conversationId: string, durationMinutes?: number) => Promise<{ success: boolean; error?: string }>;
  stopShare: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  stopAllShares: () => Promise<void>;
  isSharing: (conversationId: string) => boolean;
  getShare: (conversationId: string) => LiveLocationShareSession | null;
  getRemainingSeconds: (conversationId: string) => number | null;
}

const LiveLocationContext = createContext<LiveLocationContextType | undefined>(undefined);

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeActiveShares(shares: LiveLocationShareSession[]): LiveLocationShareSession[] {
  const referenceMs = Date.now();

  const filtered = shares.filter((share) => (
    share.status === 'active'
    && parseTimestamp(share.expiresAt) > referenceMs
    && typeof share.conversationId === 'string'
    && share.conversationId.length > 0
  ));

  filtered.sort((left, right) => parseTimestamp(left.expiresAt) - parseTimestamp(right.expiresAt));
  return filtered;
}

function upsertShare(existing: LiveLocationShareSession[], nextShare: LiveLocationShareSession): LiveLocationShareSession[] {
  const withoutExisting = existing.filter((share) => share.conversationId !== nextShare.conversationId);
  return normalizeActiveShares([...withoutExisting, nextShare]);
}

export const LiveLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [activeShares, setActiveShares] = useState<LiveLocationShareSession[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());

  const refreshActiveShares = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setActiveShares([]);
      return;
    }

    const { shares, error } = await listMyActiveLiveLocationShares();

    if (error) {
      console.error('Unable to refresh live location shares', error);
      return;
    }

    const normalized = normalizeActiveShares(shares);
    setActiveShares(normalized);
    await syncLiveLocationTracker(normalized);
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setActiveShares([]);
      void clearLiveLocationTracker();
      return;
    }

    setIsLoading(true);
    void refreshActiveShares().finally(() => {
      setIsLoading(false);
    });

    const interval = setInterval(() => {
      void refreshActiveShares();
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, refreshActiveShares, user?.id]);

  useEffect(() => {
    if (activeShares.length === 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      clearInterval(timer);
    };
  }, [activeShares.length]);

  useEffect(() => {
    if (activeShares.length === 0) {
      return;
    }

    const normalized = normalizeActiveShares(activeShares);
    if (normalized.length !== activeShares.length) {
      setActiveShares(normalized);
      void syncLiveLocationTracker(normalized);
    }
  }, [activeShares, nowMs]);

  const startShare = useCallback(async (
    conversationId: string,
    durationMinutes = 120,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isAuthenticated || !user?.id) {
      return { success: false, error: 'You must be signed in to share location.' };
    }

    const permissions = await requestLiveLocationPermissions();

    if (!permissions.canShare) {
      trackEvent('live_location_permission_denied', {
        scope: 'foreground',
      });
      return { success: false, error: 'Location permission is required to share live location.' };
    }

    const { share, error } = await startLiveLocationShare(conversationId, durationMinutes);
    if (error || !share) {
      return {
        success: false,
        error: error?.message || 'Unable to start live location sharing right now.',
      };
    }

    const nextShares = upsertShare(activeShares, share);
    setActiveShares(nextShares);

    await addLiveLocationShareSession(share);
    await publishCurrentLocationSnapshot();

    trackEvent('live_location_share_started', {
      backgroundGranted: permissions.backgroundGranted,
    });

    return { success: true };
  }, [activeShares, isAuthenticated, user?.id]);

  const stopShare = useCallback(async (
    conversationId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const { success, error } = await stopLiveLocationShare(conversationId);

    if (!success || error) {
      return {
        success: false,
        error: error?.message || 'Unable to stop live location sharing right now.',
      };
    }

    setActiveShares((previous) => previous.filter((share) => share.conversationId !== conversationId));
    await removeLiveLocationShareSession(conversationId);

    trackEvent('live_location_share_stopped');

    return { success: true };
  }, []);

  const stopAllShares = useCallback(async () => {
    const shares = [...activeShares];

    await Promise.allSettled(
      shares.map((share) => stopShare(share.conversationId)),
    );

    await refreshActiveShares();
  }, [activeShares, refreshActiveShares, stopShare]);

  const isSharing = useCallback((conversationId: string): boolean => {
    if (!conversationId) {
      return false;
    }

    const currentMs = Date.now();

    return activeShares.some((share) => (
      share.conversationId === conversationId
      && share.status === 'active'
      && parseTimestamp(share.expiresAt) > currentMs
    ));
  }, [activeShares]);

  const getShare = useCallback((conversationId: string): LiveLocationShareSession | null => {
    if (!conversationId) {
      return null;
    }

    return activeShares.find((share) => share.conversationId === conversationId) || null;
  }, [activeShares]);

  const getRemainingSeconds = useCallback((conversationId: string): number | null => {
    const share = getShare(conversationId);

    if (!share) {
      return null;
    }

    const expiresAtMs = parseTimestamp(share.expiresAt);
    if (!expiresAtMs) {
      return null;
    }

    const remaining = Math.floor((expiresAtMs - Date.now()) / 1_000);
    return remaining > 0 ? remaining : 0;
  }, [getShare]);

  const value = useMemo<LiveLocationContextType>(() => ({
    isLoading,
    activeShares,
    nowMs,
    refreshActiveShares,
    startShare,
    stopShare,
    stopAllShares,
    isSharing,
    getShare,
    getRemainingSeconds,
  }), [
    activeShares,
    getRemainingSeconds,
    getShare,
    isLoading,
    isSharing,
    nowMs,
    refreshActiveShares,
    startShare,
    stopAllShares,
    stopShare,
  ]);

  return (
    <LiveLocationContext.Provider value={value}>
      {children}
    </LiveLocationContext.Provider>
  );
};

export function useLiveLocation(): LiveLocationContextType {
  const context = useContext(LiveLocationContext);

  if (!context) {
    throw new Error('useLiveLocation must be used within a LiveLocationProvider');
  }

  return context;
}

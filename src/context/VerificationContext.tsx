/**
 * Verification Context
 *
 * Provides verification state management for the entire app including:
 * - User's verification status (email, phone, ID)
 * - Verification history
 *
 * NOTE: Background checks have been removed from the platform.
 */

import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useState
} from 'react';
import {
    createIdVerificationSession,
    getVerificationEvents,
    getVerificationStatus,
    logVerificationEvent,
    subscribeToVerificationUpdates
} from '../services/api/verificationApi';
import type {
    IdVerificationReminder,
    IdVerificationStatus,
    OverallVerificationStatus, VerificationEvent,
    VerificationLevel, VerificationState, VerificationStatusResponse, VerificationStep
} from '../types/verification';
import { getIdVerificationReminder } from '../utils/idVerification';
import { useAuth } from './AuthContext';

// ===========================================
// Context Type Definition
// ===========================================

interface VerificationContextType extends VerificationState {
  // Actions
  refreshStatus: () => Promise<void>;
  loadHistory: () => Promise<void>;
  startIdVerification: () => Promise<{ success: boolean; url?: string; sessionId?: string; error?: string }>;

  // Computed
  getVerificationSteps: () => VerificationStep[];
  completedStepsCount: number;
  totalStepsCount: number;
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

// ===========================================
// Provider Component
// ===========================================

export const VerificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [idVerificationStatus, setIdVerificationStatus] = useState<IdVerificationStatus>('unverified');
  const [idVerificationExpiresAt, setIdVerificationExpiresAt] = useState<string | null>(null);
  const [idVerifiedAt, setIdVerifiedAt] = useState<string | null>(null);
  const [verificationLevel, setVerificationLevel] = useState<VerificationLevel>('basic');
  const [history, setHistory] = useState<VerificationEvent[]>([]);

  // ===========================================
  // Data Loading
  // ===========================================

  const ensureVerificationHistoryForStatus = useCallback(async (
    userId: string,
    status: VerificationStatusResponse,
    existingEvents: VerificationEvent[]
  ): Promise<VerificationEvent[]> => {
    const successfulTypes = new Set(
      existingEvents
        .filter((event) => event.eventStatus === 'success')
        .map((event) => event.eventType)
    );

    const missingEventTypes: Array<'email_verified' | 'phone_verified' | 'id_verified'> = [];
    if (status.emailVerified && !successfulTypes.has('email_verified')) {
      missingEventTypes.push('email_verified');
    }
    if (status.phoneVerified && !successfulTypes.has('phone_verified')) {
      missingEventTypes.push('phone_verified');
    }
    if (status.idVerified && !successfulTypes.has('id_verified')) {
      missingEventTypes.push('id_verified');
    }

    if (missingEventTypes.length === 0) {
      return existingEvents;
    }

    const now = new Date().toISOString();
    await Promise.all(
      missingEventTypes.map((eventType) => logVerificationEvent(
        userId,
        eventType,
        'success',
        {
          source: 'auto_sync',
          synced_at: now,
        }
      ))
    );

    // Re-query after inserts so the UI shows canonical DB history rows.
    return getVerificationEvents(userId);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Load verification status from profile
      const status = await getVerificationStatus(user.id);
      if (status) {
        setEmailVerified(status.emailVerified);
        setPhoneVerified(status.phoneVerified);
        setIdVerified(status.idVerified);
        setIdVerificationStatus(status.idVerificationStatus);
        setIdVerificationExpiresAt(status.idVerificationExpiresAt);
        setIdVerifiedAt(status.idVerifiedAt);
        setVerificationLevel(status.verificationLevel);

        const existingEvents = await getVerificationEvents(user.id);
        const syncedEvents = await ensureVerificationHistoryForStatus(user.id, status, existingEvents);
        setHistory(syncedEvents);
      }
    } catch (error) {
      console.error('Error refreshing verification status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [ensureVerificationHistoryForStatus, user?.id]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [events, status] = await Promise.all([
        getVerificationEvents(user.id),
        getVerificationStatus(user.id),
      ]);

      if (status) {
        const syncedEvents = await ensureVerificationHistoryForStatus(user.id, status, events);
        setHistory(syncedEvents);
        return;
      }

      setHistory(events);
    } catch (error) {
      console.error('Error loading verification history:', error);
    }
  }, [ensureVerificationHistoryForStatus, user?.id]);

  // ===========================================
  // Computed Values
  // ===========================================

  const idVerificationReminder = useMemo<IdVerificationReminder>(() => (
    idVerificationStatus === 'verified' || idVerificationStatus === 'expired'
      ? getIdVerificationReminder(idVerificationExpiresAt)
      : {
        stage: null,
        daysUntilExpiry: null,
        expiresAt: idVerificationExpiresAt,
      }
  ), [idVerificationExpiresAt, idVerificationStatus]);

  const overallStatus = useMemo((): OverallVerificationStatus => {
    if (idVerified && verificationLevel === 'premium') return 'premium_verified';
    if (idVerified) return 'verified';
    if (idVerificationStatus === 'expired' || idVerificationReminder.stage === 'expired') return 'expired';
    if (emailVerified || phoneVerified) return 'in_progress';
    if (idVerificationStatus === 'pending') return 'in_progress';
    return 'not_started';
  }, [
    verificationLevel,
    idVerified,
    emailVerified,
    phoneVerified,
    idVerificationStatus,
    idVerificationReminder.stage,
  ]);

  const getVerificationSteps = useCallback((): VerificationStep[] => {
    const idStepStatus: VerificationStep['status'] = (() => {
      if (idVerified) return 'completed';
      if (idVerificationStatus === 'pending') return 'in_progress';
      if (idVerificationStatus === 'failed_name_mismatch' || idVerificationStatus === 'failed') return 'failed';
      if (idVerificationStatus === 'expired') return 'failed';
      return 'pending';
    })();

    const idStepDescription = (() => {
      if (idVerified && idVerificationExpiresAt) {
        return `Active until ${new Date(idVerificationExpiresAt).toLocaleDateString('en-US')}`;
      }
      if (idVerificationStatus === 'pending') {
        return 'Complete your in-progress ID verification session';
      }
      if (idVerificationStatus === 'failed_name_mismatch') {
        return 'Your profile legal name must exactly match your government photo ID';
      }
      if (idVerificationStatus === 'expired') {
        return 'Your ID verification expired. Re-verify to keep booking access';
      }
      if (idVerificationStatus === 'failed') {
        return 'Verification failed. Retry with a clear government-issued photo ID';
      }
      return 'Verify your identity with a government ID';
    })();

    const idStepActionLabel = (() => {
      if (idVerified) return undefined;
      if (idVerificationStatus === 'pending') return 'Resume';
      if (idVerificationStatus === 'expired') return 'Re-verify';
      if (idVerificationStatus === 'failed_name_mismatch' || idVerificationStatus === 'failed') return 'Retry';
      return 'Verify Now';
    })();

    const steps: VerificationStep[] = [
      {
        id: 'email',
        title: 'Email Verified',
        description: 'Verify your email address',
        icon: 'mail',
        status: emailVerified ? 'completed' : 'pending',
        completedAt: emailVerified ? new Date().toISOString() : undefined,
      },
      {
        id: 'phone',
        title: 'Phone Verified',
        description: 'Verify your phone number',
        icon: 'call',
        status: phoneVerified ? 'completed' : 'pending',
        actionLabel: phoneVerified ? undefined : 'Verify Now',
        completedAt: phoneVerified ? new Date().toISOString() : undefined,
      },
      {
        id: 'id',
        title: 'ID Verified',
        description: idStepDescription,
        icon: 'card',
        status: idStepStatus,
        actionLabel: idStepActionLabel,
        completedAt: idVerified ? (idVerifiedAt || new Date().toISOString()) : undefined,
      },
    ];

    return steps;
  }, [
    emailVerified,
    phoneVerified,
    idVerified,
    idVerificationStatus,
    idVerificationExpiresAt,
    idVerifiedAt,
  ]);

  const startIdVerification = useCallback(async (): Promise<{
    success: boolean;
    url?: string;
    sessionId?: string;
    error?: string;
  }> => {
    const { url, error, sessionId, status } = await createIdVerificationSession();

    if (!url || error) {
      return {
        success: false,
        error: error || 'Unable to start ID verification right now.',
      };
    }

    if (status) {
      setIdVerificationStatus(status);
    } else {
      setIdVerificationStatus('pending');
    }

    return {
      success: true,
      url,
      sessionId: sessionId || undefined,
    };
  }, []);

  const completedStepsCount = useMemo(() => {
    return getVerificationSteps().filter((step) => step.status === 'completed').length;
  }, [getVerificationSteps]);

  const totalStepsCount = 3; // Email, Phone, ID

  // ===========================================
  // Effects
  // ===========================================

  // Load initial data when user authenticates
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      refreshStatus();
    } else {
      // Reset state when logged out
      setIsLoading(false);
      setEmailVerified(false);
      setPhoneVerified(false);
      setIdVerified(false);
      setIdVerificationStatus('unverified');
      setIdVerificationExpiresAt(null);
      setIdVerifiedAt(null);
      setVerificationLevel('basic');
      setHistory([]);
    }
  }, [isAuthenticated, user?.id, refreshStatus]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user?.id || !isAuthenticated) return;

    // Subscribe to profile verification updates
    const unsubscribeVerification = subscribeToVerificationUpdates(
      user.id,
      () => {
        void refreshStatus();
      }
    );

    return () => {
      unsubscribeVerification();
    };
  }, [user?.id, isAuthenticated, refreshStatus]);

  // ===========================================
  // Context Value
  // ===========================================

  const value: VerificationContextType = {
    // State
    isLoading,
    emailVerified,
    phoneVerified,
    idVerified,
    idVerificationStatus,
    idVerificationExpiresAt,
    idVerifiedAt,
    idVerificationReminder,
    verificationLevel,
    overallStatus,
    history,

    // Actions
    refreshStatus,
    loadHistory,
    startIdVerification,

    // Computed
    getVerificationSteps,
    completedStepsCount,
    totalStepsCount,
  };

  return (
    <VerificationContext.Provider value={value}>
      {children}
    </VerificationContext.Provider>
  );
};

// ===========================================
// Hook
// ===========================================

export const useVerification = () => {
  const context = useContext(VerificationContext);
  if (context === undefined) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
};

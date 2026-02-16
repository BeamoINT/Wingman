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
    getVerificationEvents,
    getVerificationStatus,
    logVerificationEvent,
    subscribeToVerificationUpdates
} from '../services/api/verificationApi';
import type {
    OverallVerificationStatus, VerificationEvent,
    VerificationLevel, VerificationState, VerificationStatusResponse, VerificationStep
} from '../types/verification';
import { useAuth } from './AuthContext';

// ===========================================
// Context Type Definition
// ===========================================

interface VerificationContextType extends VerificationState {
  // Actions
  refreshStatus: () => Promise<void>;
  loadHistory: () => Promise<void>;

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

  const overallStatus = useMemo((): OverallVerificationStatus => {
    if (idVerified && verificationLevel === 'premium') return 'premium_verified';
    if (idVerified) return 'verified';
    if (emailVerified || phoneVerified) return 'in_progress';
    return 'not_started';
  }, [verificationLevel, idVerified, emailVerified, phoneVerified]);

  const getVerificationSteps = useCallback((): VerificationStep[] => {
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
        description: 'Verify your identity with a government ID',
        icon: 'card',
        status: idVerified ? 'completed' : 'pending',
        completedAt: idVerified ? new Date().toISOString() : undefined,
      },
    ];

    return steps;
  }, [emailVerified, phoneVerified, idVerified]);

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
      (data) => {
        if (typeof data.emailVerified === 'boolean') {
          setEmailVerified(data.emailVerified);
        }
        if (typeof data.phoneVerified === 'boolean') {
          setPhoneVerified(data.phoneVerified);
        }
        if (typeof data.idVerified === 'boolean') {
          setIdVerified(data.idVerified);
          setVerificationLevel(
            data.idVerified
              ? (data.verificationLevel === 'premium' ? 'premium' : 'verified')
              : 'basic'
          );
          return;
        }

        // Ignore verification_level-only updates to prevent false ID-complete states.
      }
    );

    return () => {
      unsubscribeVerification();
    };
  }, [user?.id, isAuthenticated]);

  // ===========================================
  // Context Value
  // ===========================================

  const value: VerificationContextType = {
    // State
    isLoading,
    emailVerified,
    phoneVerified,
    idVerified,
    verificationLevel,
    overallStatus,
    history,

    // Actions
    refreshStatus,
    loadHistory,

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

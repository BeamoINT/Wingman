/**
 * Verification Context
 *
 * Provides verification state management for the entire app including:
 * - User's verification status (email, phone, ID)
 * - Verification preferences
 * - Verification history
 *
 * NOTE: Background checks have been removed from the platform.
 */

import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useState
} from 'react';
import {
    getVerificationEvents, getVerificationPreferences, getVerificationStatus, subscribeToVerificationUpdates, upsertVerificationPreferences
} from '../services/api/verificationApi';
import type {
    OverallVerificationStatus, VerificationEvent,
    VerificationLevel, VerificationPreferences, VerificationState, VerificationStep
} from '../types/verification';
import { useAuth } from './AuthContext';

// ===========================================
// Context Type Definition
// ===========================================

interface VerificationContextType extends VerificationState {
  // Actions
  refreshStatus: () => Promise<void>;
  updatePreferences: (
    prefs: Partial<Omit<VerificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
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
  const [preferences, setPreferences] = useState<VerificationPreferences | null>(null);
  const [history, setHistory] = useState<VerificationEvent[]>([]);

  // ===========================================
  // Data Loading
  // ===========================================

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
      }

      // Load preferences
      const prefs = await getVerificationPreferences(user.id);
      setPreferences(prefs);
    } catch (error) {
      console.error('Error refreshing verification status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;

    try {
      const events = await getVerificationEvents(user.id);
      setHistory(events);
    } catch (error) {
      console.error('Error loading verification history:', error);
    }
  }, [user?.id]);

  // ===========================================
  // Actions
  // ===========================================

  const updatePreferences = useCallback(
    async (
      prefs: Partial<Omit<VerificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
    ) => {
      if (!user?.id) return;

      try {
        const updated = await upsertVerificationPreferences(user.id, prefs);
        if (updated) {
          setPreferences(updated);
        }
      } catch (error) {
        console.error('Error updating verification preferences:', error);
      }
    },
    [user?.id]
  );

  // ===========================================
  // Computed Values
  // ===========================================

  const overallStatus = useMemo((): OverallVerificationStatus => {
    if (verificationLevel === 'premium') return 'premium_verified';
    if (idVerified) return 'verified';
    return 'not_started';
  }, [verificationLevel, idVerified]);

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
      setPreferences(null);
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
        setVerificationLevel(data.verificationLevel);
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
    preferences,
    history,

    // Actions
    refreshStatus,
    updatePreferences,
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

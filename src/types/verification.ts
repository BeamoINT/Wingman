/**
 * Verification Types for Wingman App
 * Types for verification events and status
 *
 * NOTE: Background checks have been removed from the platform.
 * Verification now consists of: Email, Phone, ID verification only.
 */

// ===========================================
// Verification Event Types
// ===========================================

/**
 * Types of verification events
 */
export type VerificationEventType =
  | 'email_verified'
  | 'phone_verified'
  | 'id_verified'
  | 'id_verification_failed'
  | 'verification_level_upgraded';

/**
 * Status of a verification event
 */
export type VerificationEventStatus = 'success' | 'failed' | 'pending';

/**
 * Verification event record (for history/audit)
 */
export interface VerificationEvent {
  id: string;
  userId: string;
  eventType: VerificationEventType;
  eventStatus: VerificationEventStatus;
  eventData?: Record<string, unknown>;
  createdAt: string;
}

// ===========================================
// Verification Step Types (UI)
// ===========================================

/**
 * Status of a verification step in the UI
 */
export type VerificationStepStatus = 'completed' | 'in_progress' | 'pending' | 'failed';

/**
 * Verification step for display in the UI
 */
export interface VerificationStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: VerificationStepStatus;
  action?: () => void;
  actionLabel?: string;
  completedAt?: string;
}

// ===========================================
// Overall Verification Status Types
// ===========================================

/**
 * Overall verification status for a user
 */
export type OverallVerificationStatus =
  | 'not_started'       // No verification completed
  | 'in_progress'       // Some verification in progress
  | 'verified'          // ID verified
  | 'premium_verified'; // Premium verified

/**
 * Verification level (matches database enum)
 * NOTE: 'background' level removed - no longer used
 */
export type VerificationLevel = 'basic' | 'verified' | 'premium';

// ===========================================
// Verification Context State Types
// ===========================================

/**
 * Complete verification state for context
 */
export interface VerificationState {
  isLoading: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  verificationLevel: VerificationLevel;
  overallStatus: OverallVerificationStatus;
  history: VerificationEvent[];
}

/**
 * Default verification state
 */
export const defaultVerificationState: VerificationState = {
  isLoading: true,
  emailVerified: false,
  phoneVerified: false,
  idVerified: false,
  verificationLevel: 'basic',
  overallStatus: 'not_started',
  history: [],
};

// ===========================================
// API Response Types
// ===========================================

/**
 * Response from getting verification status
 */
export interface VerificationStatusResponse {
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  verificationLevel: VerificationLevel;
}

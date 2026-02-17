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
  | 'id_verification_started'
  | 'id_verification_processing'
  | 'id_verification_expired'
  | 'id_verification_reminder_sent'
  | 'id_verification_invalidated_name_change'
  | 'id_verification_status_update'
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
  | 'expired'           // Previously verified but currently expired
  | 'verified'          // ID verified
  | 'premium_verified'; // Premium verified

export type IdVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'expired'
  | 'failed_name_mismatch'
  | 'failed';

export type IdVerificationFailureReason =
  | 'name_mismatch'
  | 'photo_mismatch'
  | 'document_unreadable'
  | 'document_expired'
  | 'selfie_capture_failed'
  | 'photo_id_attestation_missing'
  | 'requires_input'
  | 'verification_canceled'
  | 'verification_failed'
  | string;

export type IdVerificationStartErrorCode =
  | 'STRIPE_IDENTITY_NOT_ENABLED'
  | 'STRIPE_KEY_INVALID'
  | 'STRIPE_ACCOUNT_INCOMPLETE'
  | 'ID_VERIFICATION_UNAVAILABLE';

export type IdVerificationReminderStage = 90 | 30 | 7 | 1 | 'expired' | null;

export interface IdVerificationReminder {
  stage: IdVerificationReminderStage;
  daysUntilExpiry: number | null;
  expiresAt: string | null;
}

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
  idVerificationStatus: IdVerificationStatus;
  idVerificationFailureCode: IdVerificationFailureReason | null;
  idVerificationFailureMessage: string | null;
  idVerificationExpiresAt: string | null;
  idVerifiedAt: string | null;
  idVerificationReminder: IdVerificationReminder;
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
  idVerificationStatus: 'unverified',
  idVerificationFailureCode: null,
  idVerificationFailureMessage: null,
  idVerificationExpiresAt: null,
  idVerifiedAt: null,
  idVerificationReminder: {
    stage: null,
    daysUntilExpiry: null,
    expiresAt: null,
  },
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
  idVerificationStatus: IdVerificationStatus;
  idVerificationFailureCode: IdVerificationFailureReason | null;
  idVerificationFailureMessage: string | null;
  idVerificationExpiresAt: string | null;
  idVerifiedAt: string | null;
  profilePhotoIdMatchAttested: boolean;
  verificationLevel: VerificationLevel;
}

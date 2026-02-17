import { COMPANION_AGREEMENT } from '../../legal';
import type {
  CompanionData,
} from './companions';
import type {
  WingmanOnboardingState,
  WingmanProfileSetupPayload,
} from '../../types';
import { supabase } from '../supabase';

type OnboardingStateRow = {
  current_step?: number;
  total_steps?: number;
  id_verification_completed?: boolean;
  id_verification_status?: string;
  id_verification_failure_code?: string | null;
  id_verification_failure_message?: string | null;
  companion_agreement_completed?: boolean;
  companion_agreement_version?: string | null;
  companion_agreement_accepted_at?: string | null;
  profile_setup_completed?: boolean;
  profile_setup_completed_at?: string | null;
  onboarding_last_step?: number;
  companion_id?: string | null;
  companion_application_status?: string | null;
};

type AcceptAgreementRow = {
  companion_agreement_accepted?: boolean;
  companion_agreement_accepted_at?: string;
  companion_agreement_version?: string;
};

type CompanionRow = {
  id?: string;
  user_id?: string;
  hourly_rate?: number;
  specialties?: string[];
  languages?: string[];
  about?: string;
  gallery?: string[];
  is_active?: boolean;
  is_available?: boolean;
  rating?: number;
  review_count?: number;
  completed_bookings?: number;
  response_time?: string;
  created_at?: string;
  updated_at?: string;
};

function normalizeOnboardingState(row: OnboardingStateRow | null): WingmanOnboardingState {
  const currentStep = row?.current_step === 2 ? 2 : row?.current_step === 3 ? 3 : 1;

  return {
    currentStep,
    totalSteps: 3,
    idVerificationCompleted: row?.id_verification_completed === true,
    idVerificationStatus: typeof row?.id_verification_status === 'string'
      ? row.id_verification_status
      : 'unverified',
    idVerificationFailureCode: typeof row?.id_verification_failure_code === 'string'
      ? row.id_verification_failure_code
      : null,
    idVerificationFailureMessage: typeof row?.id_verification_failure_message === 'string'
      ? row.id_verification_failure_message
      : null,
    companionAgreementCompleted: row?.companion_agreement_completed === true,
    companionAgreementVersion: typeof row?.companion_agreement_version === 'string'
      ? row.companion_agreement_version
      : null,
    companionAgreementAcceptedAt: typeof row?.companion_agreement_accepted_at === 'string'
      ? row.companion_agreement_accepted_at
      : null,
    profileSetupCompleted: row?.profile_setup_completed === true,
    profileSetupCompletedAt: typeof row?.profile_setup_completed_at === 'string'
      ? row.profile_setup_completed_at
      : null,
    onboardingLastStep: typeof row?.onboarding_last_step === 'number'
      ? Math.max(1, Math.min(3, Math.round(row.onboarding_last_step)))
      : currentStep,
    companionId: typeof row?.companion_id === 'string' ? row.companion_id : null,
    companionApplicationStatus: typeof row?.companion_application_status === 'string'
      ? row.companion_application_status
      : null,
  };
}

function normalizeCompanionRow(row: CompanionRow): CompanionData {
  const now = new Date().toISOString();

  return {
    id: typeof row.id === 'string' ? row.id : '',
    user_id: typeof row.user_id === 'string' ? row.user_id : '',
    hourly_rate: Number(row.hourly_rate || 0),
    specialties: Array.isArray(row.specialties) ? row.specialties : [],
    languages: Array.isArray(row.languages) ? row.languages : [],
    about: typeof row.about === 'string' ? row.about : '',
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    is_active: row.is_active !== false,
    is_available: row.is_available !== false,
    rating: Number(row.rating || 0),
    review_count: Number(row.review_count || 0),
    completed_bookings: Number(row.completed_bookings || 0),
    response_time: typeof row.response_time === 'string' && row.response_time.trim()
      ? row.response_time
      : 'Usually responds within 1 hour',
    created_at: typeof row.created_at === 'string' ? row.created_at : now,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : now,
    user: undefined,
  };
}

export async function getWingmanOnboardingState(): Promise<{
  state: WingmanOnboardingState;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .rpc('get_wingman_onboarding_state_v1');

    if (error) {
      return {
        state: normalizeOnboardingState(null),
        error: new Error(error.message || 'Failed to load wingman onboarding state'),
      };
    }

    const row = Array.isArray(data) ? (data[0] as OnboardingStateRow | undefined) : (data as OnboardingStateRow | null);
    return {
      state: normalizeOnboardingState(row || null),
      error: null,
    };
  } catch (err) {
    return {
      state: normalizeOnboardingState(null),
      error: err instanceof Error ? err : new Error('Failed to load wingman onboarding state'),
    };
  }
}

export async function acceptWingmanAgreement(version = COMPANION_AGREEMENT.version): Promise<{
  success: boolean;
  acceptedAt: string | null;
  acceptedVersion: string | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('accept_companion_agreement_v1', {
      p_agreement_version: version,
      p_source: 'onboarding',
    });

    if (error) {
      return {
        success: false,
        acceptedAt: null,
        acceptedVersion: null,
        error: new Error(error.message || 'Failed to accept Wingman Agreement'),
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as AcceptAgreementRow | null | undefined;
    return {
      success: row?.companion_agreement_accepted === true,
      acceptedAt: typeof row?.companion_agreement_accepted_at === 'string'
        ? row.companion_agreement_accepted_at
        : null,
      acceptedVersion: typeof row?.companion_agreement_version === 'string'
        ? row.companion_agreement_version
        : version,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      acceptedAt: null,
      acceptedVersion: null,
      error: err instanceof Error ? err : new Error('Failed to accept Wingman Agreement'),
    };
  }
}

export async function upsertWingmanProfile(payload: WingmanProfileSetupPayload): Promise<{
  companion: CompanionData | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('upsert_wingman_profile_v1', {
      p_specialties: payload.specialties,
      p_hourly_rate: payload.hourlyRate,
      p_about: payload.about,
      p_languages: payload.languages,
      p_gallery: payload.gallery,
      p_is_available: payload.isAvailable,
    });

    if (error) {
      return {
        companion: null,
        error: new Error(error.message || 'Failed to save wingman profile'),
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as CompanionRow | null | undefined;
    if (!row) {
      return {
        companion: null,
        error: new Error('Profile save returned no data'),
      };
    }

    return {
      companion: normalizeCompanionRow(row),
      error: null,
    };
  } catch (err) {
    return {
      companion: null,
      error: err instanceof Error ? err : new Error('Failed to save wingman profile'),
    };
  }
}

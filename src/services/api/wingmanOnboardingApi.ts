import { COMPANION_AGREEMENT } from '../../legal';
import type {
  CompanionData,
} from './companions';
import type {
  WingmanOnboardingState,
  WingmanProfileSetupPayload,
} from '../../types';
import { supabase } from '../supabase';

type QueryError = {
  code?: string | null;
  message?: string | null;
};

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

type LegacyProfileRow = {
  id_verified?: boolean;
  id_verification_status?: string | null;
  id_verification_failure_code?: string | null;
  id_verification_failure_message?: string | null;
};

type LegacyCompanionApplicationRow = {
  status?: string | null;
  companion_agreement_accepted?: boolean;
  companion_agreement_accepted_at?: string | null;
  companion_agreement_version?: string | null;
  profile_setup_completed_at?: string | null;
  onboarding_last_step?: number | null;
  id_verification_failure_code?: string | null;
  id_verification_failure_message?: string | null;
};

const PROFILE_SELECT_CANDIDATES = [
  'id_verified,id_verification_status,id_verification_failure_code,id_verification_failure_message',
  'id_verified,id_verification_status',
  'id_verified',
] as const;

const COMPANION_APPLICATION_SELECT_CANDIDATES = [
  'status,companion_agreement_accepted,companion_agreement_accepted_at,companion_agreement_version,profile_setup_completed_at,onboarding_last_step,id_verification_failure_code,id_verification_failure_message',
  'status,companion_agreement_accepted,companion_agreement_accepted_at,profile_setup_completed_at,onboarding_last_step,id_verification_failure_code,id_verification_failure_message',
  'status,companion_agreement_accepted,companion_agreement_accepted_at',
  'status,companion_agreement_accepted',
  'status',
] as const;

function toOptionalNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function clampStep(value: unknown, fallback: 1 | 2 | 3): 1 | 2 | 3 {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (numeric >= 3) {
    return 3;
  }

  if (numeric >= 2) {
    return 2;
  }

  return 1;
}

function isMissingOnboardingStateRpc(error: unknown): boolean {
  const typedError = error as QueryError | null | undefined;
  const message = String(typedError?.message || '').toLowerCase();
  const code = String(typedError?.code || '');

  if (!message.includes('get_wingman_onboarding_state_v1')) {
    return false;
  }

  if (message.includes('could not find the function') || message.includes('schema cache') || message.includes('does not exist')) {
    return true;
  }

  return code === '42883' || code.startsWith('PGRST');
}

async function loadLegacyProfileRow(userId: string): Promise<{
  row: LegacyProfileRow | null;
  error: Error | null;
}> {
  for (const selectColumns of PROFILE_SELECT_CANDIDATES) {
    const { data, error } = await supabase
      .from('profiles')
      .select(selectColumns)
      .eq('id', userId)
      .maybeSingle();

    if (!error) {
      return {
        row: (data as LegacyProfileRow | null) || null,
        error: null,
      };
    }

    if (error.code === 'PGRST116' || error.code === '42P01') {
      return { row: null, error: null };
    }

    if (error.code === '42703') {
      continue;
    }

    return {
      row: null,
      error: new Error(error.message || 'Failed to load profile state'),
    };
  }

  return { row: null, error: null };
}

async function loadLegacyCompanionApplicationRow(userId: string): Promise<{
  row: LegacyCompanionApplicationRow | null;
  selectedColumns: Set<string>;
  error: Error | null;
}> {
  for (const selectColumns of COMPANION_APPLICATION_SELECT_CANDIDATES) {
    const { data, error } = await supabase
      .from('companion_applications')
      .select(selectColumns)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error) {
      return {
        row: (data as LegacyCompanionApplicationRow | null) || null,
        selectedColumns: new Set(selectColumns.split(',').map((column) => column.trim())),
        error: null,
      };
    }

    if (error.code === 'PGRST116' || error.code === '42P01') {
      return {
        row: null,
        selectedColumns: new Set(),
        error: null,
      };
    }

    if (error.code === '42703') {
      continue;
    }

    return {
      row: null,
      selectedColumns: new Set(),
      error: new Error(error.message || 'Failed to load companion application state'),
    };
  }

  return {
    row: null,
    selectedColumns: new Set(),
    error: null,
  };
}

async function loadCompanionId(userId: string): Promise<{ companionId: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('companions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error) {
    return {
      companionId: typeof data?.id === 'string' ? data.id : null,
      error: null,
    };
  }

  if (error.code === 'PGRST116' || error.code === '42P01') {
    return { companionId: null, error: null };
  }

  return {
    companionId: null,
    error: new Error(error.message || 'Failed to load companion profile state'),
  };
}

function deriveOnboardingStateFromLegacyData(input: {
  profile: LegacyProfileRow | null;
  application: LegacyCompanionApplicationRow | null;
  applicationSelectedColumns: Set<string>;
  companionId: string | null;
}): WingmanOnboardingState {
  const profileStatus = toOptionalNonEmptyString(input.profile?.id_verification_status);
  const idVerifiedFlag = input.profile?.id_verified === true;
  const idVerificationCompleted = profileStatus ? profileStatus === 'verified' : idVerifiedFlag;
  const idVerificationStatus = profileStatus || (idVerifiedFlag ? 'verified' : 'unverified');
  const agreementAcceptedAt = toOptionalNonEmptyString(input.application?.companion_agreement_accepted_at);
  const agreementVersion = toOptionalNonEmptyString(input.application?.companion_agreement_version);
  const hasAgreementAcceptedAtColumn = input.applicationSelectedColumns.has('companion_agreement_accepted_at');
  const hasAgreementVersionColumn = input.applicationSelectedColumns.has('companion_agreement_version');
  const agreementAccepted = input.application?.companion_agreement_accepted === true;
  const companionAgreementCompleted = agreementAccepted
    && (!hasAgreementAcceptedAtColumn || agreementAcceptedAt !== null)
    && (!hasAgreementVersionColumn || agreementVersion === COMPANION_AGREEMENT.version);
  const profileSetupCompletedAt = toOptionalNonEmptyString(input.application?.profile_setup_completed_at);
  const profileSetupCompleted = input.companionId !== null || profileSetupCompletedAt !== null;

  const currentStep: 1 | 2 | 3 = !idVerificationCompleted
    ? 1
    : !companionAgreementCompleted
      ? 2
      : 3;

  const onboardingLastStep = input.application?.onboarding_last_step == null
    ? (profileSetupCompleted ? 3 : currentStep)
    : clampStep(input.application.onboarding_last_step, profileSetupCompleted ? 3 : currentStep);

  const failureCode = toOptionalNonEmptyString(input.profile?.id_verification_failure_code)
    || toOptionalNonEmptyString(input.application?.id_verification_failure_code);

  const failureMessage = toOptionalNonEmptyString(input.profile?.id_verification_failure_message)
    || toOptionalNonEmptyString(input.application?.id_verification_failure_message);

  return {
    currentStep,
    totalSteps: 3,
    idVerificationCompleted,
    idVerificationStatus,
    idVerificationFailureCode: failureCode,
    idVerificationFailureMessage: failureMessage,
    companionAgreementCompleted,
    companionAgreementVersion: hasAgreementVersionColumn
      ? agreementVersion
      : (companionAgreementCompleted ? COMPANION_AGREEMENT.version : null),
    companionAgreementAcceptedAt: agreementAcceptedAt,
    profileSetupCompleted,
    profileSetupCompletedAt,
    onboardingLastStep,
    companionId: input.companionId,
    companionApplicationStatus: toOptionalNonEmptyString(input.application?.status),
  };
}

async function getWingmanOnboardingStateFromLegacyTables(): Promise<{
  state: WingmanOnboardingState;
  error: Error | null;
}> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return {
      state: normalizeOnboardingState(null),
      error: new Error(authError.message || 'Failed to load wingman onboarding state'),
    };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return {
      state: normalizeOnboardingState(null),
      error: new Error('Not authenticated'),
    };
  }

  const [profileResult, applicationResult, companionResult] = await Promise.all([
    loadLegacyProfileRow(userId),
    loadLegacyCompanionApplicationRow(userId),
    loadCompanionId(userId),
  ]);

  const fallbackError = profileResult.error || applicationResult.error || companionResult.error;
  if (fallbackError) {
    return {
      state: normalizeOnboardingState(null),
      error: fallbackError,
    };
  }

  return {
    state: deriveOnboardingStateFromLegacyData({
      profile: profileResult.row,
      application: applicationResult.row,
      applicationSelectedColumns: applicationResult.selectedColumns,
      companionId: companionResult.companionId,
    }),
    error: null,
  };
}

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
      if (isMissingOnboardingStateRpc(error)) {
        return getWingmanOnboardingStateFromLegacyTables();
      }
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
    if (isMissingOnboardingStateRpc(err)) {
      return getWingmanOnboardingStateFromLegacyTables();
    }
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

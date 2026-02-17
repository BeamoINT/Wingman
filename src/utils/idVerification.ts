export type IdVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'expired'
  | 'failed_name_mismatch'
  | 'failed';

export const ID_VERIFICATION_REMINDER_THRESHOLDS = [90, 30, 7, 1] as const;
export type IdVerificationReminderThreshold = (typeof ID_VERIFICATION_REMINDER_THRESHOLDS)[number];
export type IdVerificationReminderStage = IdVerificationReminderThreshold | 'expired' | null;

interface IdVerificationLike {
  id_verified?: unknown;
  id_verification_status?: unknown;
  id_verification_expires_at?: unknown;
}

export interface IdVerificationReminder {
  stage: IdVerificationReminderStage;
  daysUntilExpiry: number | null;
  expiresAt: string | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function normalizeIdVerificationStatus(value: unknown): IdVerificationStatus {
  const normalized = String(value || '').trim().toLowerCase();

  switch (normalized) {
    case 'pending':
    case 'verified':
    case 'expired':
    case 'failed_name_mismatch':
    case 'failed':
      return normalized;
    case 'unverified':
    default:
      return 'unverified';
  }
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function getDaysUntilIdVerificationExpiry(
  expiresAt: string | null | undefined,
  now = new Date()
): number | null {
  const expiryDate = parseIsoDate(expiresAt);
  if (!expiryDate) {
    return null;
  }

  const nowUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expiryUtcDay = Date.UTC(
    expiryDate.getUTCFullYear(),
    expiryDate.getUTCMonth(),
    expiryDate.getUTCDate()
  );

  return Math.floor((expiryUtcDay - nowUtcDay) / MS_PER_DAY);
}

export function isIdVerificationActive(profile: IdVerificationLike, now = new Date()): boolean {
  const status = normalizeIdVerificationStatus(profile.id_verification_status);
  const isVerified = profile.id_verified === true;

  if (!isVerified || status !== 'verified') {
    return false;
  }

  const daysUntilExpiry = getDaysUntilIdVerificationExpiry(
    typeof profile.id_verification_expires_at === 'string' ? profile.id_verification_expires_at : null,
    now
  );

  if (daysUntilExpiry === null) {
    return false;
  }

  return daysUntilExpiry >= 0;
}

export function getIdVerificationReminder(
  expiresAt: string | null | undefined,
  now = new Date()
): IdVerificationReminder {
  const daysUntilExpiry = getDaysUntilIdVerificationExpiry(expiresAt, now);
  const normalizedExpiresAt = typeof expiresAt === 'string' ? expiresAt : null;

  if (daysUntilExpiry === null) {
    return {
      stage: null,
      daysUntilExpiry: null,
      expiresAt: normalizedExpiresAt,
    };
  }

  if (daysUntilExpiry < 0) {
    return {
      stage: 'expired',
      daysUntilExpiry,
      expiresAt: normalizedExpiresAt,
    };
  }

  if (ID_VERIFICATION_REMINDER_THRESHOLDS.includes(daysUntilExpiry as IdVerificationReminderThreshold)) {
    return {
      stage: daysUntilExpiry as IdVerificationReminderThreshold,
      daysUntilExpiry,
      expiresAt: normalizedExpiresAt,
    };
  }

  return {
    stage: null,
    daysUntilExpiry,
    expiresAt: normalizedExpiresAt,
  };
}

export function formatIdVerificationDate(iso: string | null | undefined): string {
  if (!iso) {
    return 'Unknown';
  }

  const parsed = parseIsoDate(iso);
  if (!parsed) {
    return 'Unknown';
  }

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatIdVerifiedDuration(verifiedAt: string | null | undefined, now = new Date()): string {
  const start = parseIsoDate(verifiedAt);
  if (!start) {
    return 'Unknown duration';
  }

  if (start.getTime() > now.getTime()) {
    return '0 days';
  }

  let years = now.getUTCFullYear() - start.getUTCFullYear();
  let months = now.getUTCMonth() - start.getUTCMonth();
  const dayDiff = now.getUTCDate() - start.getUTCDate();

  if (dayDiff < 0) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) {
    const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY));
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  const yearPart = years > 0 ? `${years} year${years === 1 ? '' : 's'}` : '';
  const monthPart = months > 0 ? `${months} month${months === 1 ? '' : 's'}` : '';

  if (yearPart && monthPart) {
    return `${yearPart}, ${monthPart}`;
  }

  return yearPart || monthPart;
}

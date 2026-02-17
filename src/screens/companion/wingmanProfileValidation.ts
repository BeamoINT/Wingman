import { WINGMAN_RATE_MAX, WINGMAN_RATE_MIN } from '../../constants/wingmanProfile';
import type { WingmanProfileSetupPayload } from '../../types';
import type { WingmanProfileFormErrors } from '../../components/companion/WingmanProfileForm';

export function validateWingmanProfile(payload: WingmanProfileSetupPayload): WingmanProfileFormErrors {
  const errors: WingmanProfileFormErrors = {};

  if (payload.specialties.length < 2) {
    errors.specialties = 'Select at least 2 specialties.';
  }

  if (!Number.isFinite(payload.hourlyRate) || payload.hourlyRate < WINGMAN_RATE_MIN || payload.hourlyRate > WINGMAN_RATE_MAX) {
    errors.hourlyRate = `Hourly rate must be between $${WINGMAN_RATE_MIN} and $${WINGMAN_RATE_MAX}.`;
  }

  if (payload.about.trim().length < 50) {
    errors.about = 'About section must be at least 50 characters.';
  }

  if (payload.languages.length < 1) {
    errors.languages = 'Select at least one language.';
  }

  if (payload.gallery.length > 6) {
    errors.gallery = 'You can upload up to 6 gallery photos.';
  }

  return errors;
}

export function hasWingmanProfileErrors(errors: WingmanProfileFormErrors): boolean {
  return Object.values(errors).some((value) => typeof value === 'string' && value.length > 0);
}

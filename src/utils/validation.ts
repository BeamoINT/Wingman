/**
 * Form Validation Utilities
 *
 * Provides comprehensive validation functions for forms throughout the app.
 * All validators return an error message string or undefined if valid.
 */

export type ValidationResult = string | undefined;
export type Validator<T = string> = (value: T) => ValidationResult;

// Email validation (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Password requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_LOWERCASE_REGEX = /[a-z]/;
const PASSWORD_NUMBER_REGEX = /[0-9]/;
const PASSWORD_SPECIAL_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

// Phone validation (US format)
const PHONE_REGEX = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

/**
 * Validate required field.
 */
export const required = (message = 'This field is required'): Validator => {
  return (value: string) => {
    if (!value || value.trim().length === 0) {
      return message;
    }
    return undefined;
  };
};

/**
 * Validate minimum length.
 */
export const minLength = (min: number, message?: string): Validator => {
  return (value: string) => {
    if (value && value.length < min) {
      return message || `Must be at least ${min} characters`;
    }
    return undefined;
  };
};

/**
 * Validate maximum length.
 */
export const maxLength = (max: number, message?: string): Validator => {
  return (value: string) => {
    if (value && value.length > max) {
      return message || `Must be no more than ${max} characters`;
    }
    return undefined;
  };
};

/**
 * Validate email format.
 */
export const email = (message = 'Please enter a valid email address'): Validator => {
  return (value: string) => {
    if (value && !EMAIL_REGEX.test(value)) {
      return message;
    }
    return undefined;
  };
};

/**
 * Validate password strength.
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const password = (message?: string): Validator => {
  return (value: string) => {
    if (!value) return undefined;

    const errors: string[] = [];

    if (value.length < PASSWORD_MIN_LENGTH) {
      errors.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    if (!PASSWORD_UPPERCASE_REGEX.test(value)) {
      errors.push('one uppercase letter');
    }
    if (!PASSWORD_LOWERCASE_REGEX.test(value)) {
      errors.push('one lowercase letter');
    }
    if (!PASSWORD_NUMBER_REGEX.test(value)) {
      errors.push('one number');
    }
    if (!PASSWORD_SPECIAL_REGEX.test(value)) {
      errors.push('one special character');
    }

    if (errors.length > 0) {
      return message || `Password must contain ${errors.join(', ')}`;
    }

    return undefined;
  };
};

/**
 * Simple password validation (less strict).
 * Requirements:
 * - Minimum 8 characters
 * - At least one letter
 * - At least one number
 */
export const simplePassword = (message?: string): Validator => {
  return (value: string) => {
    if (!value) return undefined;

    if (value.length < PASSWORD_MIN_LENGTH) {
      return message || `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }
    if (!/[a-zA-Z]/.test(value)) {
      return message || 'Password must contain at least one letter';
    }
    if (!/[0-9]/.test(value)) {
      return message || 'Password must contain at least one number';
    }

    return undefined;
  };
};

/**
 * Validate password confirmation matches.
 */
export const passwordMatch = (password: string, message = 'Passwords do not match'): Validator => {
  return (value: string) => {
    if (value && value !== password) {
      return message;
    }
    return undefined;
  };
};

/**
 * Validate phone number format.
 */
export const phone = (message = 'Please enter a valid phone number'): Validator => {
  return (value: string) => {
    if (value && !PHONE_REGEX.test(value.replace(/\s/g, ''))) {
      return message;
    }
    return undefined;
  };
};

/**
 * Validate date of birth (must be 18+).
 */
export const adultAge = (minAge = 18, message?: string): Validator => {
  return (value: string) => {
    if (!value) return undefined;

    const birthDate = new Date(value);
    if (isNaN(birthDate.getTime())) {
      return 'Please enter a valid date';
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < minAge) {
      return message || `You must be at least ${minAge} years old`;
    }

    // Check for reasonable max age (120)
    if (age > 120) {
      return 'Please enter a valid birth date';
    }

    return undefined;
  };
};

/**
 * Validate date format (YYYY-MM-DD or MM/DD/YYYY).
 */
export const dateFormat = (message = 'Please enter a valid date'): Validator => {
  return (value: string) => {
    if (!value) return undefined;

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return message;
    }

    return undefined;
  };
};

/**
 * Validate URL format.
 */
export const url = (message = 'Please enter a valid URL'): Validator => {
  return (value: string) => {
    if (!value) return undefined;

    try {
      new URL(value);
      return undefined;
    } catch {
      return message;
    }
  };
};

/**
 * Validate against regex pattern.
 */
export const pattern = (regex: RegExp, message: string): Validator => {
  return (value: string) => {
    if (value && !regex.test(value)) {
      return message;
    }
    return undefined;
  };
};

/**
 * Validate name (letters, spaces, hyphens, apostrophes only).
 */
export const name = (message = 'Please enter a valid name'): Validator => {
  return (value: string) => {
    if (!value) return undefined;

    // Allow letters (including accented), spaces, hyphens, apostrophes
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(value)) {
      return message;
    }

    if (value.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }

    return undefined;
  };
};

/**
 * Combine multiple validators.
 */
export const compose = (...validators: Validator[]): Validator => {
  return (value: string) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) {
        return error;
      }
    }
    return undefined;
  };
};

/**
 * Validate form fields and return all errors.
 */
export function validateForm<T extends Record<string, unknown>>(
  values: T,
  validators: Partial<Record<keyof T, Validator>>
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};

  for (const [field, validator] of Object.entries(validators)) {
    const value = values[field as keyof T];
    const error = (validator as Validator)(String(value ?? ''));
    if (error) {
      errors[field as keyof T] = error;
    }
  }

  return errors;
}

/**
 * Check if a form has any errors.
 */
export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(error => error !== undefined);
}

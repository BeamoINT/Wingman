/**
 * Input Sanitization Utilities
 *
 * Provides functions to sanitize user input before display or storage
 * to prevent XSS attacks and ensure data integrity.
 */

/**
 * HTML entities to escape for XSS prevention.
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS attacks.
 */
export function escapeHtml(input: string): string {
  if (!input) return '';

  return input.replace(/[&<>"'`=\/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Remove HTML tags from a string.
 */
export function stripHtml(input: string): string {
  if (!input) return '';

  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

/**
 * Sanitize a string for safe display.
 * - Trims whitespace
 * - Normalizes newlines
 * - Escapes HTML entities
 * - Removes control characters
 */
export function sanitizeText(input: string): string {
  if (!input) return '';

  return input
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize newlines
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Escape HTML
    .replace(/[&<>"'`=\/]/g, char => HTML_ENTITIES[char] || char)
    // Trim
    .trim();
}

/**
 * Sanitize user name (remove dangerous characters, trim).
 */
export function sanitizeName(input: string): string {
  if (!input) return '';

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Allow only letters, numbers, spaces, hyphens, apostrophes
    .replace(/[^a-zA-ZÀ-ÿ0-9\s'-]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Sanitize email (lowercase, trim, remove dangerous characters).
 */
export function sanitizeEmail(input: string): string {
  if (!input) return '';

  return input
    .toLowerCase()
    .trim()
    // Remove anything that's not allowed in emails
    .replace(/[^a-z0-9.!#$%&'*+/=?^_`{|}~@-]/g, '');
}

/**
 * Sanitize phone number (keep only digits and + for country code).
 */
export function sanitizePhone(input: string): string {
  if (!input) return '';

  // Keep only digits and leading +
  const cleaned = input.replace(/[^\d+]/g, '');

  // Ensure + is only at the start
  if (cleaned.includes('+')) {
    const parts = cleaned.split('+');
    if (parts[0] === '') {
      return '+' + parts.slice(1).join('').replace(/\+/g, '');
    }
    return parts.join('');
  }

  return cleaned;
}

/**
 * Sanitize URL (validate and normalize).
 */
export function sanitizeUrl(input: string): string {
  if (!input) return '';

  let url = input.trim();

  // Add protocol if missing
  if (url && !url.match(/^https?:\/\//i)) {
    url = 'https://' + url;
  }

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * Sanitize search query (remove special characters that could break search).
 */
export function sanitizeSearch(input: string): string {
  if (!input) return '';

  return input
    // Remove HTML
    .replace(/<[^>]*>/g, '')
    // Remove special regex characters
    .replace(/[.*+?^${}()|[\]\\]/g, ' ')
    // Collapse spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncate(input: string, maxLength: number, suffix = '...'): string {
  if (!input) return '';

  if (input.length <= maxLength) {
    return input;
  }

  return input.slice(0, maxLength - suffix.length).trim() + suffix;
}

/**
 * Mask sensitive data (e.g., email, phone).
 */
export function maskEmail(email: string): string {
  if (!email) return '';

  const [local, domain] = email.split('@');
  if (!domain) return email;

  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(Math.min(local.length - 2, 5)) + local[local.length - 1]
    : local;

  return `${maskedLocal}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;

  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * Remove sensitive data from objects before logging.
 */
export function sanitizeForLogging<T extends Record<string, unknown>>(
  obj: T,
  sensitiveKeys: string[] = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'creditCard']
): T {
  const result = { ...obj };

  for (const key of Object.keys(result)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
      result[key as keyof T] = '[REDACTED]' as T[keyof T];
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key as keyof T] = sanitizeForLogging(
        result[key] as Record<string, unknown>,
        sensitiveKeys
      ) as T[keyof T];
    }
  }

  return result;
}

/**
 * Safe console.log that removes sensitive data.
 */
export function safeLog(message: string, data?: Record<string, unknown>): void {
  if (__DEV__) {
    if (data) {
      console.log(message, sanitizeForLogging(data));
    } else {
      console.log(message);
    }
  }
}

/**
 * Phone Verification API Service
 * Handles phone number verification using Twilio via Supabase Edge Functions
 */

import { supabase } from '../supabase';
import { updatePhoneVerification } from './profiles';

export interface SendOtpResult {
  success: boolean;
  error?: string;
}

export interface VerifyOtpResult {
  verified: boolean;
  error?: string;
}

function formatPhoneVerificationError(rawMessage: string, code?: unknown): string {
  const message = rawMessage.trim();
  const normalizedCode = typeof code === 'number' ? code : Number(code);

  if (normalizedCode === 60200 || /Invalid parameter `To`/i.test(message)) {
    return 'Please enter a valid phone number, including area code.';
  }

  if (/Max send attempts reached/i.test(message)) {
    return 'Too many verification attempts. Please wait a few minutes and try again.';
  }

  if (/Permission to send an SMS/i.test(message) || /unverified/i.test(message)) {
    return 'SMS delivery is not enabled for this number yet. Please use a different number.';
  }

  return message || 'Failed to send verification code';
}

async function extractFunctionError(error: unknown): Promise<{ message: string; code?: unknown }> {
  const fallback = {
    message: (error as { message?: string })?.message || 'Request failed',
    code: (error as { code?: unknown })?.code,
  };

  const maybeContext = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  if (!maybeContext?.json) {
    return fallback;
  }

  try {
    const payload = await maybeContext.json();
    if (payload && typeof payload === 'object') {
      const payloadObj = payload as { error?: unknown; message?: unknown; code?: unknown };
      const payloadMessage =
        (typeof payloadObj.error === 'string' && payloadObj.error)
        || (typeof payloadObj.message === 'string' && payloadObj.message)
        || fallback.message;

      return {
        message: payloadMessage,
        code: payloadObj.code,
      };
    }
  } catch {
    // Fall back to top-level error message if JSON parse fails.
  }

  return fallback;
}

/**
 * Send OTP code to phone number
 */
export async function sendPhoneOtp(phone: string): Promise<SendOtpResult> {
  try {
    // Format phone number to E.164 format if needed
    const formattedPhone = formatPhoneNumber(phone);

    const { data, error } = await supabase.functions.invoke('send-phone-otp', {
      body: { phone: formattedPhone },
    });

    if (error) {
      const details = await extractFunctionError(error);
      const userMessage = formatPhoneVerificationError(details.message, details.code);
      console.warn('Phone OTP request failed:', details.message);
      return { success: false, error: userMessage };
    }

    if (data?.error) {
      return {
        success: false,
        error: formatPhoneVerificationError(String(data.error), (data as { code?: unknown }).code),
      };
    }

    return { success: data?.status === 'pending' };
  } catch (err) {
    console.error('Error in sendPhoneOtp:', err);
    return { success: false, error: 'Failed to send verification code. Please try again.' };
  }
}

/**
 * Verify OTP code for phone number
 */
export async function verifyPhoneOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  try {
    const formattedPhone = formatPhoneNumber(phone);

    const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
      body: { phone: formattedPhone, code },
    });

    if (error) {
      const details = await extractFunctionError(error);
      console.warn('Phone OTP verification failed:', details.message);
      return { verified: false, error: formatPhoneVerificationError(details.message, details.code) };
    }

    if (data?.error) {
      return {
        verified: false,
        error: formatPhoneVerificationError(String(data.error), (data as { code?: unknown }).code),
      };
    }

    if (data?.verified) {
      // Update the user's profile to mark phone as verified
      await updatePhoneVerification(true);
      return { verified: true };
    }

    return { verified: false, error: 'Invalid verification code' };
  } catch (err) {
    console.error('Error in verifyPhoneOtp:', err);
    return { verified: false, error: 'Failed to verify code. Please try again.' };
  }
}

/**
 * Format phone number to E.164 format
 * Assumes US numbers if no country code provided
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If already has country code (11+ digits starting with 1)
  if (digits.length >= 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If 10 digits, assume US
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If already has + prefix, just clean it
  if (phone.startsWith('+')) {
    return `+${digits}`;
  }

  // Return as-is with + prefix
  return `+${digits}`;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  // Must have at least 10 digits (US) or 11+ (with country code)
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Format phone number for display
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    // US format: +1 (XXX) XXX-XXXX
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    // US format without country code: (XXX) XXX-XXXX
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Return formatted with + prefix
  return `+${digits}`;
}

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
      console.error('Error sending phone OTP:', error);
      return { success: false, error: error.message || 'Failed to send verification code' };
    }

    if (data?.error) {
      return { success: false, error: data.error };
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
      console.error('Error verifying phone OTP:', error);
      return { verified: false, error: error.message || 'Failed to verify code' };
    }

    if (data?.error) {
      return { verified: false, error: data.error };
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

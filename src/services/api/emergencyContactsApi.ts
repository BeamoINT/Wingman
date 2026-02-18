import { getAuthToken, supabase } from '../supabase';

export interface EmergencyContactRecord {
  id: string;
  user_id: string;
  name: string;
  phone_e164: string;
  relationship: string;
  is_verified: boolean;
  verified_at: string | null;
  verification_last_sent_at: string | null;
  verification_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertEmergencyContactInput {
  contactId?: string;
  name: string;
  phone: string;
  relationship: string;
}

function toError(error: unknown, fallback: string): Error {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return new Error(message);
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return new Error(error);
  }

  return new Error(fallback);
}

function formatPhoneE164(rawPhone: string): string {
  const value = String(rawPhone || '').trim();
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (value.startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export async function listEmergencyContacts(): Promise<{
  contacts: EmergencyContactRecord[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('list_emergency_contacts_v1');

    if (error) {
      return { contacts: [], error: toError(error, 'Unable to load emergency contacts.') };
    }

    return {
      contacts: Array.isArray(data) ? (data as EmergencyContactRecord[]) : [],
      error: null,
    };
  } catch (error) {
    return { contacts: [], error: toError(error, 'Unable to load emergency contacts.') };
  }
}

export async function upsertEmergencyContact(input: UpsertEmergencyContactInput): Promise<{
  contact: EmergencyContactRecord | null;
  error: Error | null;
}> {
  try {
    const name = input.name.trim();
    const relationship = input.relationship.trim();
    const phoneE164 = formatPhoneE164(input.phone);

    if (!name) {
      return { contact: null, error: new Error('Name is required.') };
    }

    if (!relationship) {
      return { contact: null, error: new Error('Relationship is required.') };
    }

    if (!/^\+[1-9][0-9]{6,14}$/.test(phoneE164)) {
      return { contact: null, error: new Error('Enter a valid phone number including country code.') };
    }

    const { data, error } = await supabase.rpc('upsert_emergency_contact_v1', {
      p_contact_id: input.contactId || null,
      p_name: name,
      p_phone_e164: phoneE164,
      p_relationship: relationship,
    });

    if (error) {
      return { contact: null, error: toError(error, 'Unable to save emergency contact.') };
    }

    const contact = (Array.isArray(data) ? data[0] : data) as EmergencyContactRecord | null;
    return {
      contact,
      error: contact ? null : new Error('Unable to save emergency contact.'),
    };
  } catch (error) {
    return {
      contact: null,
      error: toError(error, 'Unable to save emergency contact.'),
    };
  }
}

export async function deleteEmergencyContact(contactId: string): Promise<{
  success: boolean;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('delete_emergency_contact_v1', {
      p_contact_id: contactId,
    });

    if (error) {
      return { success: false, error: toError(error, 'Unable to delete emergency contact.') };
    }

    return { success: data === true, error: null };
  } catch (error) {
    return {
      success: false,
      error: toError(error, 'Unable to delete emergency contact.'),
    };
  }
}

async function invokeContactOtpFunction(functionName: 'send-emergency-contact-otp' | 'verify-emergency-contact-otp', body: Record<string, unknown>) {
  const accessToken = await getAuthToken();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (error) {
    return {
      data: null,
      error: toError(error, 'Emergency contact verification is unavailable.'),
    };
  }

  return {
    data: (data || {}) as Record<string, unknown>,
    error: null,
  };
}

export async function sendEmergencyContactOtp(contactId: string): Promise<{
  success: boolean;
  alreadyVerified?: boolean;
  error: Error | null;
}> {
  try {
    const { data, error } = await invokeContactOtpFunction('send-emergency-contact-otp', {
      contactId,
    });

    if (error || !data) {
      return { success: false, error: error || new Error('Unable to send verification code.') };
    }

    if (data.error) {
      return {
        success: false,
        error: toError(data.error, 'Unable to send verification code.'),
      };
    }

    return {
      success: data.success === true || data.status === 'pending',
      alreadyVerified: data.alreadyVerified === true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: toError(error, 'Unable to send verification code.'),
    };
  }
}

export async function verifyEmergencyContactOtp(contactId: string, code: string): Promise<{
  verified: boolean;
  error: Error | null;
}> {
  try {
    const { data, error } = await invokeContactOtpFunction('verify-emergency-contact-otp', {
      contactId,
      code: code.trim(),
    });

    if (error || !data) {
      return { verified: false, error: error || new Error('Unable to verify code.') };
    }

    if (data.error) {
      return {
        verified: false,
        error: toError(data.error, 'Unable to verify code.'),
      };
    }

    return {
      verified: data.verified === true,
      error: data.verified === true ? null : new Error('Verification failed.'),
    };
  } catch (error) {
    return {
      verified: false,
      error: toError(error, 'Unable to verify code.'),
    };
  }
}

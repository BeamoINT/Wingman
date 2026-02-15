/**
 * Companion Application API Service
 * Handles companion onboarding: application CRUD, file uploads, submission
 */

import type {
    CompanionApplication,
    CompanionApplicationStatus,
    IdDocumentType
} from '../../types';
import { supabase } from '../supabase';

// ===========================================
// Transform
// ===========================================

function transformApplication(data: Record<string, unknown>): CompanionApplication {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    status: data.status as CompanionApplicationStatus,
    idDocumentUrl: (data.id_document_url as string) || null,
    idDocumentType: (data.id_document_type as IdDocumentType) || null,
    selfieUrl: (data.selfie_url as string) || null,
    specialties: (data.specialties as CompanionApplication['specialties']) || [],
    hourlyRate: (data.hourly_rate as number) || null,
    about: (data.about as string) || '',
    languages: (data.languages as string[]) || [],
    gallery: (data.gallery as string[]) || [],
    companionAgreementAccepted: (data.companion_agreement_accepted as boolean) || false,
    companionAgreementAcceptedAt: (data.companion_agreement_accepted_at as string) || null,
    rejectionReason: (data.rejection_reason as string) || null,
    submittedAt: (data.submitted_at as string) || null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

// ===========================================
// Application CRUD
// ===========================================

/**
 * Get the current user's companion application (if any)
 */
export async function getCompanionApplication(): Promise<{
  application: CompanionApplication | null;
  error: Error | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { application: null, error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('companion_applications')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching companion application:', error);
      return { application: null, error };
    }

    return {
      application: data ? transformApplication(data as Record<string, unknown>) : null,
      error: null,
    };
  } catch (err) {
    console.error('Error in getCompanionApplication:', err);
    return { application: null, error: err as Error };
  }
}

/**
 * Create a new companion application (draft)
 */
export async function createCompanionApplication(): Promise<{
  application: CompanionApplication | null;
  error: Error | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { application: null, error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('companion_applications')
      .insert({ user_id: user.id, status: 'draft' })
      .select()
      .single();

    if (error) {
      console.error('Error creating companion application:', error);
      return { application: null, error };
    }

    return {
      application: transformApplication(data as Record<string, unknown>),
      error: null,
    };
  } catch (err) {
    console.error('Error in createCompanionApplication:', err);
    return { application: null, error: err as Error };
  }
}

/**
 * Update a companion application with partial data
 */
export async function updateCompanionApplication(
  applicationId: string,
  updates: Record<string, unknown>
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('companion_applications')
      .update(updates)
      .eq('id', applicationId);

    if (error) {
      console.error('Error updating companion application:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in updateCompanionApplication:', err);
    return { success: false, error: err as Error };
  }
}

// ===========================================
// File Uploads
// ===========================================

async function uploadFileToStorage(
  bucket: string,
  path: string,
  fileUri: string
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const extension = fileUri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, upsert: true });

    if (error) {
      console.error(`Error uploading to ${bucket}:`, error);
      return { url: null, error };
    }

    // Get public URL for gallery, signed URL for private buckets
    if (bucket === 'companion-gallery') {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      return { url: urlData.publicUrl, error: null };
    }

    // Private buckets: create a long-lived signed URL for admin review
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(data.path, 60 * 60 * 24 * 365);

    if (urlError) {
      console.error(`Error creating signed URL for ${bucket}:`, urlError);
      return { url: null, error: urlError };
    }

    return { url: urlData.signedUrl, error: null };
  } catch (err) {
    console.error(`Error in uploadFileToStorage (${bucket}):`, err);
    return { url: null, error: err as Error };
  }
}

/**
 * Upload ID document to Supabase Storage
 */
export async function uploadIdDocument(
  userId: string,
  fileUri: string
): Promise<{ url: string | null; error: Error | null }> {
  const extension = fileUri.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/id-document-${Date.now()}.${extension}`;
  return uploadFileToStorage('id-documents', path, fileUri);
}

/**
 * Upload selfie to Supabase Storage
 */
export async function uploadSelfie(
  userId: string,
  fileUri: string
): Promise<{ url: string | null; error: Error | null }> {
  const extension = fileUri.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/selfie-${Date.now()}.${extension}`;
  return uploadFileToStorage('verification-selfies', path, fileUri);
}

/**
 * Upload gallery photo to Supabase Storage
 */
export async function uploadGalleryPhoto(
  userId: string,
  fileUri: string,
  index: number
): Promise<{ url: string | null; error: Error | null }> {
  const extension = fileUri.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/gallery-${index}-${Date.now()}.${extension}`;
  return uploadFileToStorage('companion-gallery', path, fileUri);
}

// ===========================================
// Submission
// ===========================================

/**
 * Submit the companion application for review.
 * Sets status to 'pending_review' and submitted_at timestamp.
 */
export async function submitCompanionApplication(
  applicationId: string
): Promise<{ success: boolean; error: Error | null }> {
  return updateCompanionApplication(applicationId, {
    status: 'pending_review',
    submitted_at: new Date().toISOString(),
  });
}

// ===========================================
// Status Checks
// ===========================================

/**
 * Check if the current user already has an active companion profile
 */
export async function checkExistingCompanionProfile(): Promise<{
  exists: boolean;
  companionId: string | null;
  error: Error | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { exists: false, companionId: null, error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('companions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error checking companion profile:', error);
      return { exists: false, companionId: null, error };
    }

    return {
      exists: !!data,
      companionId: data?.id || null,
      error: null,
    };
  } catch (err) {
    console.error('Error in checkExistingCompanionProfile:', err);
    return { exists: false, companionId: null, error: err as Error };
  }
}

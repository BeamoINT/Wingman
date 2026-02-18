import * as FileSystem from 'expo-file-system/legacy';
import { getAuthToken, supabase } from '../supabase';

export type SafetyAudioCloudRetentionAction = 'auto_delete' | 'auto_download';

export type SafetyAudioCloudRecordingStatus =
  | 'uploading'
  | 'uploaded'
  | 'upload_failed'
  | 'pending_auto_download'
  | 'deleted'
  | 'grace_deleted'
  | 'auto_downloaded';

export interface SafetyAudioCloudRecording {
  id: string;
  user_id: string;
  local_recording_id: string | null;
  bucket: string;
  object_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_ms: number | null;
  recorded_at: string;
  uploaded_at: string | null;
  expires_at: string;
  status: SafetyAudioCloudRecordingStatus;
  auto_action: SafetyAudioCloudRetentionAction | null;
  retry_count: number;
  last_retry_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  pending_auto_download_set_at: string | null;
  downloaded_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyAudioCloudNotice {
  id: string;
  user_id: string;
  recording_id: string | null;
  notice_type: 'retention_warning' | 'retention_action' | 'grace_warning' | 'grace_expired';
  threshold_days: number | null;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyAudioCloudUploadUrl {
  recordingId: string;
  bucket: string;
  objectPath: string;
  signedUrl: string;
  token?: string;
  path?: string;
  status: SafetyAudioCloudRecordingStatus;
  expiresAt: string;
  maxUploadSizeBytes: number;
}

export interface SafetyAudioCloudDownloadUrl {
  recordingId: string;
  signedUrl: string;
  expiresIn: number;
  metadata: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    durationMs: number;
    recordedAt: string;
    expiresAt: string;
    status: SafetyAudioCloudRecordingStatus;
  };
}

export type SafetyAudioCloudErrorCode =
  | 'PRO_REQUIRED'
  | 'GRACE_READ_ONLY'
  | 'UPLOAD_RATE_LIMITED'
  | 'UPLOAD_UNAVAILABLE'
  | 'DOWNLOAD_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export class SafetyAudioCloudError extends Error {
  code: SafetyAudioCloudErrorCode;

  constructor(code: SafetyAudioCloudErrorCode, message: string) {
    super(message);
    this.name = 'SafetyAudioCloudError';
    this.code = code;
  }
}

type EdgeErrorBody = {
  error?: string;
  message?: string;
  errorCode?: string;
};

type FunctionsErrorLike = {
  message?: string;
  context?: Response;
};

function asPositiveInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeCloudErrorCode(value: unknown): SafetyAudioCloudErrorCode {
  const code = String(value || '').trim().toUpperCase();
  switch (code) {
    case 'PRO_REQUIRED':
      return 'PRO_REQUIRED';
    case 'GRACE_READ_ONLY':
      return 'GRACE_READ_ONLY';
    case 'UPLOAD_RATE_LIMITED':
      return 'UPLOAD_RATE_LIMITED';
    case 'UPLOAD_UNAVAILABLE':
      return 'UPLOAD_UNAVAILABLE';
    case 'DOWNLOAD_UNAVAILABLE':
      return 'DOWNLOAD_UNAVAILABLE';
    case 'UNAUTHORIZED':
      return 'UNAUTHORIZED';
    case 'NOT_FOUND':
      return 'NOT_FOUND';
    default:
      return 'UNKNOWN';
  }
}

async function parseFunctionsError(error: FunctionsErrorLike | null): Promise<SafetyAudioCloudError> {
  if (!error?.context) {
    return new SafetyAudioCloudError('UNKNOWN', error?.message || 'Cloud audio request failed.');
  }

  const status = error.context.status;

  try {
    const body = await error.context.clone().json() as EdgeErrorBody;
    const code = normalizeCloudErrorCode(body.errorCode);
    const message = body.error || body.message || error.message || 'Cloud audio request failed.';
    return new SafetyAudioCloudError(code, message);
  } catch {
    if (status === 401) {
      return new SafetyAudioCloudError('UNAUTHORIZED', 'Authentication required.');
    }
    if (status === 404) {
      return new SafetyAudioCloudError('NOT_FOUND', 'Cloud recording not found.');
    }
    if (status === 429) {
      return new SafetyAudioCloudError('UPLOAD_RATE_LIMITED', 'Upload rate limit reached.');
    }
    return new SafetyAudioCloudError('UNKNOWN', error.message || 'Cloud audio request failed.');
  }
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string' && error.trim()) {
    return new Error(error);
  }

  return new Error(fallback);
}

async function invokeEdge<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const accessToken = await getAuthToken();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (error) {
    throw await parseFunctionsError(error as FunctionsErrorLike);
  }

  const payload = (data || {}) as EdgeErrorBody & T;
  if (payload.error || payload.message || payload.errorCode) {
    throw new SafetyAudioCloudError(
      normalizeCloudErrorCode(payload.errorCode),
      String(payload.error || payload.message || 'Cloud audio request failed.'),
    );
  }

  return payload as T;
}

export async function createSafetyAudioUploadUrl(input: {
  localRecordingId: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes: number;
  durationMs?: number;
  recordedAt: string;
  contextType: 'booking' | 'live_location' | 'manual';
  contextId?: string | null;
  source: 'manual' | 'auto_booking' | 'auto_live_location' | 'restarted' | 'cloud_download';
}): Promise<SafetyAudioCloudUploadUrl> {
  return await invokeEdge<SafetyAudioCloudUploadUrl>('create-safety-audio-upload-url', {
    localRecordingId: input.localRecordingId,
    fileName: input.fileName || null,
    mimeType: input.mimeType || 'audio/mp4',
    sizeBytes: asPositiveInt(input.sizeBytes),
    durationMs: asPositiveInt(input.durationMs || 0),
    recordedAt: input.recordedAt,
    contextType: input.contextType,
    contextId: input.contextId || null,
    source: input.source,
  });
}

export async function markSafetyAudioCloudUploadComplete(input: {
  recordingId: string;
  sizeBytes: number;
  durationMs: number;
  mimeType?: string;
}): Promise<{ recording: SafetyAudioCloudRecording | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('mark_safety_audio_cloud_upload_complete_v1', {
      p_recording_id: input.recordingId,
      p_uploaded_size_bytes: asPositiveInt(input.sizeBytes),
      p_uploaded_duration_ms: asPositiveInt(input.durationMs),
      p_mime_type: input.mimeType || null,
    });

    if (error) {
      return {
        recording: null,
        error: toError(error, 'Unable to mark cloud upload complete.'),
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as SafetyAudioCloudRecording | null;
    return {
      recording: row,
      error: null,
    };
  } catch (error) {
    return {
      recording: null,
      error: toError(error, 'Unable to mark cloud upload complete.'),
    };
  }
}

export async function markSafetyAudioCloudUploadFailed(input: {
  recordingId: string;
  errorCode?: string;
  errorMessage?: string;
}): Promise<{ recording: SafetyAudioCloudRecording | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('mark_safety_audio_cloud_upload_failed_v1', {
      p_recording_id: input.recordingId,
      p_error_code: input.errorCode || null,
      p_error_message: input.errorMessage || null,
    });

    if (error) {
      return {
        recording: null,
        error: toError(error, 'Unable to mark cloud upload failure.'),
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as SafetyAudioCloudRecording | null;
    return {
      recording: row,
      error: null,
    };
  } catch (error) {
    return {
      recording: null,
      error: toError(error, 'Unable to mark cloud upload failure.'),
    };
  }
}

export async function listMySafetyAudioCloudRecordings(input?: {
  limit?: number;
  offset?: number;
  status?: SafetyAudioCloudRecordingStatus;
}): Promise<{ recordings: SafetyAudioCloudRecording[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('list_my_safety_audio_cloud_recordings_v1', {
      p_limit: asPositiveInt(input?.limit || 50),
      p_offset: asPositiveInt(input?.offset || 0),
      p_status: input?.status || null,
    });

    if (error) {
      return {
        recordings: [],
        error: toError(error, 'Unable to load cloud safety audio recordings.'),
      };
    }

    return {
      recordings: Array.isArray(data) ? (data as SafetyAudioCloudRecording[]) : [],
      error: null,
    };
  } catch (error) {
    return {
      recordings: [],
      error: toError(error, 'Unable to load cloud safety audio recordings.'),
    };
  }
}

export async function getSafetyAudioDownloadUrl(recordingId: string): Promise<SafetyAudioCloudDownloadUrl> {
  return await invokeEdge<SafetyAudioCloudDownloadUrl>('get-safety-audio-download-url', {
    recordingId,
  });
}

export async function deleteSafetyAudioCloudRecording(recordingId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: row, error: rowError } = await supabase
      .from('safety_audio_cloud_recordings')
      .select('bucket,object_path')
      .eq('id', recordingId)
      .maybeSingle();

    if (rowError) {
      return {
        success: false,
        error: toError(rowError, 'Unable to resolve cloud recording path.'),
      };
    }

    const bucket = String(row?.bucket || 'safety-audio-cloud').trim() || 'safety-audio-cloud';
    const objectPath = String(row?.object_path || '').trim();

    if (objectPath) {
      const { error: removeError } = await supabase.storage.from(bucket).remove([objectPath]);
      if (removeError) {
        const message = String(removeError.message || '').toLowerCase();
        if (!message.includes('not found')) {
          return {
            success: false,
            error: toError(removeError, 'Unable to delete cloud recording file.'),
          };
        }
      }
    }

    const { data, error } = await supabase.rpc('delete_safety_audio_cloud_recording_v1', {
      p_recording_id: recordingId,
    });

    if (error) {
      return {
        success: false,
        error: toError(error, 'Unable to delete cloud recording metadata.'),
      };
    }

    return {
      success: data === true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: toError(error, 'Unable to delete cloud recording.'),
    };
  }
}

export async function listPendingSafetyAudioAutoDownloads(limit = 20): Promise<{
  recordings: SafetyAudioCloudRecording[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('list_pending_safety_audio_auto_downloads_v1', {
      p_limit: asPositiveInt(limit),
    });

    if (error) {
      return {
        recordings: [],
        error: toError(error, 'Unable to load pending cloud auto-downloads.'),
      };
    }

    return {
      recordings: Array.isArray(data) ? (data as SafetyAudioCloudRecording[]) : [],
      error: null,
    };
  } catch (error) {
    return {
      recordings: [],
      error: toError(error, 'Unable to load pending cloud auto-downloads.'),
    };
  }
}

export async function completeSafetyAudioAutoDownload(recordingId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('complete_safety_audio_auto_download_v1', {
      p_recording_id: recordingId,
    });

    if (error) {
      return {
        success: false,
        error: toError(error, 'Unable to mark cloud auto-download as complete.'),
      };
    }

    return {
      success: data === true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: toError(error, 'Unable to mark cloud auto-download as complete.'),
    };
  }
}

export async function getSafetyAudioCloudNotices(unreadOnly = true): Promise<{
  notices: SafetyAudioCloudNotice[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_safety_audio_cloud_notices_v1', {
      p_unread_only: unreadOnly,
    });

    if (error) {
      return {
        notices: [],
        error: toError(error, 'Unable to load cloud safety audio notices.'),
      };
    }

    return {
      notices: Array.isArray(data) ? (data as SafetyAudioCloudNotice[]) : [],
      error: null,
    };
  } catch (error) {
    return {
      notices: [],
      error: toError(error, 'Unable to load cloud safety audio notices.'),
    };
  }
}

export async function markSafetyAudioCloudNoticeRead(noticeId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('mark_safety_audio_cloud_notice_read_v1', {
      p_notice_id: noticeId,
    });

    if (error) {
      return {
        success: false,
        error: toError(error, 'Unable to mark cloud notice as read.'),
      };
    }

    return {
      success: data === true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: toError(error, 'Unable to mark cloud notice as read.'),
    };
  }
}

export async function downloadSafetyAudioCloudRecordingToLocalFile(params: {
  signedUrl: string;
  targetUri: string;
}): Promise<{ uri: string; error: Error | null }> {
  try {
    const result = await FileSystem.downloadAsync(params.signedUrl, params.targetUri);
    if (result.status < 200 || result.status >= 300) {
      return {
        uri: '',
        error: new Error(`Download returned HTTP ${result.status}`),
      };
    }

    return {
      uri: result.uri,
      error: null,
    };
  } catch (error) {
    return {
      uri: '',
      error: toError(error, 'Unable to download cloud recording to device.'),
    };
  }
}

/**
 * Wingman App Types
 */

// User Types
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'other' | 'prefer-not-to-say';
  location?: Location;
  isVerified: boolean;
  isPremium: boolean;
  subscriptionTier?: SubscriptionTier;
  proStatus?: ProStatus;
  profilePhotoIdMatchAttested?: boolean;
  profilePhotoIdMatchAttestedAt?: string | null;
  profilePhotoSource?: 'in_app_camera' | 'legacy_import' | 'unknown';
  profilePhotoCapturedAt?: string | null;
  profilePhotoCaptureVerified?: boolean;
  profilePhotoLastChangedAt?: string | null;
  idVerificationStatus?: 'unverified' | 'pending' | 'verified' | 'expired' | 'failed_name_mismatch' | 'failed';
  idVerificationExpiresAt?: string | null;
  idVerifiedAt?: string | null;
  idVerificationFailureCode?: string | null;
  idVerificationFailureMessage?: string | null;
  safetyAudioCloudGraceUntil?: string | null;
  safetyAudioCloudDowngradedAt?: string | null;
  createdAt: string;
  lastActive?: string;
}

export interface Location {
  city: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  metroAreaId?: string;
  metroAreaName?: string;
  metroCity?: string;
  metroState?: string;
  metroCountry?: string;
  autoMetroAreaId?: string;
  manualMetroAreaId?: string;
  defaultMetroAreaId?: string;
  metroSelectionMode?: 'auto' | 'manual' | 'default';
}

// Companion Types
export interface Companion {
  id: string;
  user: User;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  specialties: CompanionSpecialty[];
  languages: string[];
  availability: Availability[];
  isOnline: boolean;
  responseTime: string; // e.g., "Usually responds within 1 hour"
  completedBookings: number;
  badges: Badge[];
  gallery: string[];
  about: string;
  interests: string[];
  verificationLevel: VerificationLevel;
}

export type CompanionSpecialty =
  | 'social-events'
  | 'dining'
  | 'nightlife'
  | 'movies'
  | 'concerts'
  | 'sports'
  | 'outdoor-activities'
  | 'shopping'
  | 'travel'
  | 'coffee-chat'
  | 'workout-buddy'
  | 'professional-networking'
  | 'emotional-support'
  | 'safety-companion';

export interface Availability {
  dayOfWeek: number; // 0-6, Sunday = 0
  startTime: string; // HH:MM format
  endTime: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt: string;
}

export type VerificationLevel =
  | 'basic'        // Email verified
  | 'verified'     // ID verified
  | 'premium';     // Premium verified

// Booking Types
export interface Booking {
  id: string;
  companion: Companion;
  user: User;
  conversationId?: string;
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // in hours
  totalPrice: number;
  location: BookingLocation;
  activityType: CompanionSpecialty;
  notes?: string;
  locationPlaceId?: string;
  meetupStatus?: MeetupBookingStatus;
  meetupProposalId?: string;
  meetupAgreedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export interface BookingLocation {
  name: string;
  address: string;
  placeId?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  type: 'restaurant' | 'bar' | 'cafe' | 'venue' | 'public' | 'other';
}

export type MeetupBookingStatus = 'none' | 'proposed' | 'countered' | 'declined' | 'agreed';
export type MeetupProposalStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'withdrawn';
export type MeetupResponseAction = 'accept' | 'decline' | 'counter';

export interface MeetupLocationProposal {
  id: string;
  conversationId: string;
  bookingId?: string;
  proposerUserId: string;
  placeId?: string;
  placeName: string;
  placeAddress?: string;
  latitude?: number;
  longitude?: number;
  note?: string;
  status: MeetupProposalStatus;
  responseByUserId?: string;
  responseNote?: string;
  respondedAt?: string;
  supersedesProposalId?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Subscription Types
export type SubscriptionTier = 'free' | 'pro';

export type ProStatus = 'inactive' | 'active' | 'grace' | 'past_due' | 'canceled';
export type ProBillingPeriod = 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  tier: SubscriptionTier;
  price: number;
  billingPeriod: ProBillingPeriod;
  features: SubscriptionFeature[];
}

export interface SubscriptionFeature {
  name: string;
  description: string;
  included: boolean;
}

// Review Types
export interface Review {
  id: string;
  booking: Booking;
  reviewer: User;
  reviewee: User;
  rating: number;
  comment?: string;
  tags: string[];
  createdAt: string;
  isVerified: boolean;
}

// Message Types
export interface Conversation {
  id: string;
  participants: User[];
  kind?: 'direct' | 'group' | 'event';
  title?: string;
  avatarUrl?: string;
  memberCount?: number;
  groupId?: string;
  eventId?: string;
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export type MessageKind = 'text' | 'image' | 'video' | 'system' | 'booking-request';

export interface MessageAttachment {
  id?: string;
  mediaKind: 'image' | 'video';
  bucket: string;
  objectPath: string;
  thumbnailObjectPath?: string;
  mediaKeyBase64?: string;
  mediaNonceBase64?: string;
  thumbnailKeyBase64?: string;
  thumbnailNonceBase64?: string;
  ciphertextSizeBytes: number;
  originalSizeBytes?: number;
  durationMs?: number;
  width?: number;
  height?: number;
  sha256: string;
  decryptedUri?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: User;
  content: string;
  messageKind?: MessageKind;
  type: 'text' | 'image' | 'booking-request' | 'system';
  attachments?: MessageAttachment[];
  senderDeviceId?: string;
  encryptionVersion?: string;
  replyToMessageId?: string;
  isRead: boolean;
  createdAt: string;
}

// Safety Types
export interface SafetyCheck {
  id: string;
  booking: Booking;
  scheduledAt: string;
  respondedAt?: string;
  status: 'pending' | 'safe' | 'alert' | 'emergency';
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary?: boolean;
  isVerified?: boolean;
  verifiedAt?: string | null;
}

export interface SafetyPreferences {
  checkinsEnabled: boolean;
  checkinIntervalMinutes: number;
  checkinResponseWindowMinutes: number;
  sosEnabled: boolean;
  autoShareLiveLocation: boolean;
  autoRecordSafetyAudioOnVisit: boolean;
  cloudAudioRetentionAction: SafetyAudioCloudRetentionAction;
  cloudAudioWifiOnlyUpload: boolean;
}

export interface SafetySession {
  sessionId: string;
  bookingId: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'expired';
  checkinIntervalMinutes: number;
  responseWindowMinutes: number;
  startedAt?: string | null;
  endedAt?: string | null;
  nextCheckinAt?: string | null;
  pendingCheckinId?: string | null;
  pendingCheckinRespondBy?: string | null;
}

export type SafetyAudioContextKey = string;
export type SafetyAudioOverrideState = 'force_on' | 'force_off' | null;
export type SafetyAudioRecordingState =
  | 'starting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'interrupted';
export type SafetyAudioInterruptionReason =
  | 'phone_call'
  | 'audio_focus_loss'
  | 'media_services_reset'
  | 'app_killed'
  | 'unknown';

export interface SafetyAudioRecording {
  id: string;
  uri: string;
  createdAt: string;
  expiresAt: string;
  durationMs: number;
  sizeBytes: number;
  contextType: 'booking' | 'live_location' | 'manual';
  contextId: string | null;
  source: 'manual' | 'auto_booking' | 'auto_live_location' | 'restarted' | 'cloud_download';
  cloudRecordingId?: string | null;
  cloudSyncState?: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'paused';
  cloudUploadedAt?: string | null;
  cloudLastError?: string | null;
}

export interface SafetyAudioSession {
  sessionId: string;
  startedAt: string;
  segmentStartedAt: string;
  contextKeys: SafetyAudioContextKey[];
  reason: 'manual' | 'auto';
  state: SafetyAudioRecordingState;
  elapsedMsAtLastStateChange: number;
  lastStateChangedAt: string;
  lastInterruptionReason?: SafetyAudioInterruptionReason;
}

export interface SafetyAudioStorageStatus {
  freeBytes: number | null;
  warning: boolean;
  critical: boolean;
  warningThresholdBytes: number;
  criticalThresholdBytes: number;
}

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
  last_error_code: string | null;
  last_error_message: string | null;
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
}

export type SafetyAudioCloudSyncState =
  | 'idle'
  | 'uploading'
  | 'paused_network'
  | 'paused_wifi_only'
  | 'paused_non_pro'
  | 'error';

export interface SafetyAudioCloudSyncSnapshot {
  state: SafetyAudioCloudSyncState;
  queueCount: number;
  uploadingCount: number;
  activeUploadLocalRecordingId: string | null;
  activeUploadProgress: number;
  lastError: string | null;
}

// Companion Application Types
export type CompanionApplicationStatus =
  | 'draft'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type IdDocumentType = 'passport' | 'drivers_license' | 'national_id';

export interface CompanionApplication {
  id: string;
  userId: string;
  status: CompanionApplicationStatus;
  idDocumentUrl: string | null;
  idDocumentType: IdDocumentType | null;
  selfieUrl: string | null;
  specialties: CompanionSpecialty[];
  hourlyRate: number | null;
  about: string;
  languages: string[];
  gallery: string[];
  companionAgreementAccepted: boolean;
  companionAgreementAcceptedAt: string | null;
  companionAgreementVersion: string | null;
  companionAgreementAcknowledgedAt: string | null;
  onboardingLastStep: number | null;
  profileSetupCompletedAt: string | null;
  idVerificationFailureCode: string | null;
  idVerificationFailureMessage: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WingmanOnboardingState {
  currentStep: 1 | 2 | 3;
  totalSteps: 3;
  idVerificationCompleted: boolean;
  idVerificationStatus: string;
  idVerificationFailureCode: string | null;
  idVerificationFailureMessage: string | null;
  companionAgreementCompleted: boolean;
  companionAgreementVersion: string | null;
  companionAgreementAcceptedAt: string | null;
  profileSetupCompleted: boolean;
  profileSetupCompletedAt: string | null;
  onboardingLastStep: number;
  companionId: string | null;
  companionApplicationStatus: string | null;
}

export interface WingmanProfileSetupPayload {
  specialties: CompanionSpecialty[];
  hourlyRate: number;
  about: string;
  languages: string[];
  gallery: string[];
  isAvailable: boolean;
}

export interface CompanionOnboardingData {
  idDocumentUri: string;
  idDocumentType: IdDocumentType;
  selfieUri: string;
  specialties: CompanionSpecialty[];
  hourlyRate: number;
  about: string;
  languages: string[];
  gallery: string[];
}

export const defaultCompanionOnboardingData: CompanionOnboardingData = {
  idDocumentUri: '',
  idDocumentType: 'drivers_license',
  selfieUri: '',
  specialties: [],
  hourlyRate: 25,
  about: '',
  languages: [],
  gallery: [],
};

// Signup Types
export type Gender = 'male' | 'female' | 'non-binary' | 'other' | 'prefer-not-to-say';

export interface SignupData {
  // Step 1: Account
  email: string;
  password: string;

  // Step 2: Personal
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | '';
  phone: string;

  // Step 3: Location
  city: string;
  state: string;
  country: string;
  countryCode?: string;

  // Step 4: Interests
  interests: CompanionSpecialty[];

  // Step 5: About
  bio: string;
  lookingFor: string[];
  languages: string[];

  // Step 6: Photo
  avatar: string;
}

export const defaultSignupData: SignupData = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  city: '',
  state: '',
  country: '',
  countryCode: '',
  interests: [],
  bio: '',
  lookingFor: [],
  languages: [],
  avatar: '',
};

// Legal Document Types (for navigation)
export type LegalDocumentType =
  | 'terms-of-service'
  | 'privacy-policy'
  | 'community-guidelines'
  | 'cookie-policy'
  | 'acceptable-use'
  | 'refund-policy'
  | 'safety-disclaimer'
  | 'copyright-policy'
  | 'california-privacy'
  | 'electronic-signature'
  | 'companion-agreement';

// Navigation Types
export type RootStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  Signup: { resumeStep?: number } | undefined;
  VerifyEmail: undefined;
  VerifyPhone: {
    source?: 'signup' | 'requirements' | 'profile' | 'booking';
  } | undefined;
  ForgotPassword: { email?: string } | undefined;
  MagicLinkLogin: { email?: string } | undefined;
  Tutorial: undefined;
  Main: undefined;
  CompanionProfile: { companionId: string };
  Booking: { companionId: string; conversationId?: string };
  BookingConfirmation: { bookingId: string };
  Chat: { conversationId: string };
  Directions: {
    destinationName: string;
    destinationAddress?: string;
    destinationPlaceId?: string;
    destinationLatitude?: number;
    destinationLongitude?: number;
    conversationId?: string;
    source?: 'chat_meetup' | 'booking_confirmation' | 'bookings_list';
  };
  Settings: undefined;
  BlockedUsers: undefined;
  EmergencyContacts: undefined;
  SafetyAudioRecordings: undefined;
  CloudSafetyAudioRecordings: undefined;
  ChangePassword: undefined;
  ChangeEmail: undefined;
  EditProfile: undefined;
  Subscription: undefined;
  Safety: undefined;
  Verification: {
    source?: 'profile' | 'requirements' | 'booking_final_step';
    companionId?: string;
  } | undefined;
  Notifications: undefined;
  // Verification sub-screens (accessible from verification tab)
  VerificationHistory: undefined;
  // Legal screens
  LegalDocument: { documentType: LegalDocumentType };
  // Companion onboarding screens
  CompanionOnboarding: { resumeStep?: number } | undefined;
  CompanionAgreement: { returnToOnboarding?: boolean } | undefined;
  WingmanProfileSetup: { source?: 'onboarding' | 'dashboard' } | undefined;
  CompanionApplicationStatus: undefined;
  CompanionDashboard: undefined;
  // Friends feature screens
  Friends: undefined;
  FriendMatching: undefined;
  SocialFeed: undefined;
  Groups: undefined;
  Events: undefined;
  FriendRequests: undefined;
  MetroPreferences: undefined;
  MetroMapPicker: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Friends: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
};

// Verification Stack Navigator Types
export type VerificationStackParamList = {
  VerificationMain: undefined;
  VerificationHistory: undefined;
};

// Re-export verification types
// Re-export location types
export * from './location';
export * from './verification';

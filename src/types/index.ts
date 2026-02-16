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
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // in hours
  totalPrice: number;
  location: BookingLocation;
  activityType: CompanionSpecialty;
  notes?: string;
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
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  type: 'restaurant' | 'bar' | 'cafe' | 'venue' | 'public' | 'other';
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
  isPrimary: boolean;
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
  rejectionReason: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  Booking: { companionId: string };
  BookingConfirmation: { bookingId: string };
  Chat: { conversationId: string };
  Settings: undefined;
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
  CompanionApplicationStatus: undefined;
  CompanionDashboard: undefined;
  // Friends feature screens
  Friends: undefined;
  FriendMatching: undefined;
  SocialFeed: undefined;
  Groups: undefined;
  Events: undefined;
  FriendRequests: undefined;
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

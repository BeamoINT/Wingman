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
  isBackgroundChecked: boolean;
  isPremium: boolean;
  subscriptionTier?: SubscriptionTier;
  createdAt: string;
  lastActive?: string;
}

export interface Location {
  city: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
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
  | 'background'   // Background check passed
  | 'premium';     // Premium verified + background

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
export type SubscriptionTier = 'free' | 'plus' | 'premium' | 'elite';

export interface Subscription {
  id: string;
  tier: SubscriptionTier;
  price: number;
  billingPeriod: 'monthly' | 'yearly';
  features: SubscriptionFeature[];
  isPopular?: boolean;
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
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: User;
  content: string;
  type: 'text' | 'image' | 'booking-request' | 'system';
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
  interests: [],
  bio: '',
  lookingFor: [],
  languages: [],
  avatar: '',
};

// Navigation Types
export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  SignIn: undefined;
  Signup: undefined;
  Tutorial: undefined;
  Main: undefined;
  CompanionProfile: { companionId: string };
  Booking: { companionId: string };
  BookingConfirmation: { bookingId: string };
  Chat: { conversationId: string };
  Settings: undefined;
  EditProfile: undefined;
  Subscription: undefined;
  Safety: undefined;
  Verification: undefined;
  Notifications: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
};

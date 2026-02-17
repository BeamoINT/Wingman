import { Ionicons } from '@expo/vector-icons';
import type { CompanionSpecialty } from '../types';

export const WINGMAN_RATE_MIN = 15;
export const WINGMAN_RATE_MAX = 500;

export const WINGMAN_SPECIALTIES: {
  label: string;
  value: CompanionSpecialty;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { label: 'Social Events', value: 'social-events', icon: 'people' },
  { label: 'Dining', value: 'dining', icon: 'restaurant' },
  { label: 'Nightlife', value: 'nightlife', icon: 'wine' },
  { label: 'Movies', value: 'movies', icon: 'film' },
  { label: 'Concerts', value: 'concerts', icon: 'musical-notes' },
  { label: 'Sports', value: 'sports', icon: 'football' },
  { label: 'Outdoor', value: 'outdoor-activities', icon: 'leaf' },
  { label: 'Shopping', value: 'shopping', icon: 'bag' },
  { label: 'Travel', value: 'travel', icon: 'airplane' },
  { label: 'Coffee & Chat', value: 'coffee-chat', icon: 'cafe' },
  { label: 'Workout', value: 'workout-buddy', icon: 'fitness' },
  { label: 'Networking', value: 'professional-networking', icon: 'briefcase' },
  { label: 'Emotional Support', value: 'emotional-support', icon: 'heart' },
  { label: 'Safety', value: 'safety-companion', icon: 'shield' },
];

export const WINGMAN_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi',
];

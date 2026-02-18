/**
 * Location-related type definitions for the Wingman app
 */

/**
 * Geographic regions for grouping countries
 */
export type CountryRegion =
  | 'Africa'
  | 'Americas'
  | 'Asia'
  | 'Europe'
  | 'Oceania';

/**
 * Country data structure
 */
export interface Country {
  /** ISO 3166-1 alpha-2 code (e.g., "US", "GB") */
  code: string;
  /** Country name in English */
  name: string;
  /** Emoji flag (e.g., "\uD83C\uDDFA\uD83C\uDDF8") */
  flag: string;
  /** International dial code (e.g., "+1") */
  dialCode: string;
  /** Geographic region */
  region: CountryRegion;
}

/**
 * Google Places Autocomplete prediction
 */
export interface PlacePrediction {
  /** Unique place identifier for fetching details */
  placeId: string;
  /** Result type category from Google Places */
  placeType?: 'city' | 'meetup';
  /** Primary text (usually city name) */
  mainText: string;
  /** Secondary text (state, country) */
  secondaryText: string;
  /** Full formatted description */
  description: string;
}

/**
 * Full place details from Google Places API
 */
export interface PlaceDetails {
  /** Unique place identifier */
  placeId: string;
  /** Display place name (venue/city) */
  name?: string;
  /** City/locality name */
  city: string;
  /** State/province/region name */
  state: string;
  /** Country name */
  country: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Geographic coordinates */
  coordinates: {
    latitude: number;
    longitude: number;
  };
  /** Full formatted address */
  formattedAddress: string;
}

/**
 * Location data structure used throughout the app
 */
export interface LocationData {
  /** City/locality name */
  city: string;
  /** State/province/region (optional) */
  state?: string;
  /** Country name */
  country: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Geographic coordinates (optional) */
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Props for the LocationPicker component
 */
export interface LocationPickerProps {
  /** Current location value */
  value: LocationData;
  /** Callback when location changes */
  onChange: (location: LocationData) => void;
  /** Error message to display */
  error?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

/**
 * Props for the CountryPicker component
 */
export interface CountryPickerProps {
  /** Whether the picker is visible */
  visible: boolean;
  /** Currently selected country code */
  selectedCode?: string;
  /** Callback when a country is selected */
  onSelect: (country: Country) => void;
  /** Callback to close the picker */
  onClose: () => void;
}

/**
 * Props for the CitySearch component
 */
export interface CitySearchProps {
  /** Whether the search is visible */
  visible: boolean;
  /** Country code to filter results */
  countryCode?: string;
  /** Callback when a place is selected */
  onSelect: (details: PlaceDetails) => void;
  /** Callback to close the search */
  onClose: () => void;
}

/**
 * Location permission status
 */
export type LocationPermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied';

/**
 * Location detection state
 */
export interface LocationDetectionState {
  /** Whether location detection is in progress */
  isDetecting: boolean;
  /** Permission status */
  permissionStatus: LocationPermissionStatus;
  /** Error message if detection failed */
  error?: string;
}

/**
 * Travel mode for route calculations.
 */
export type DirectionsTravelMode =
  | 'driving'
  | 'walking'
  | 'bicycling'
  | 'transit';

/**
 * Location input contract used by in-app directions requests.
 */
export interface DirectionsLocationInput {
  latitude?: number;
  longitude?: number;
  placeId?: string;
  address?: string;
}

/**
 * A single leg summary from Google Directions.
 */
export interface DirectionsLegSummary {
  startAddress: string;
  endAddress: string;
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds?: number | null;
  startLocation: {
    latitude?: number | null;
    longitude?: number | null;
  };
  endLocation: {
    latitude?: number | null;
    longitude?: number | null;
  };
}

/**
 * Route option returned by the directions API.
 */
export interface DirectionsRoute {
  id: string;
  summary: string;
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds?: number | null;
  polyline: string;
  warnings: string[];
  legs: DirectionsLegSummary[];
}

/**
 * Directions response payload.
 */
export interface DirectionsResponse {
  routes: DirectionsRoute[];
  recommendedRouteId: string | null;
}

/**
 * Live location share lifecycle state.
 */
export type LiveLocationShareStatus = 'active' | 'stopped' | 'expired';

/**
 * Current user's live location sharing state per conversation.
 */
export interface LiveLocationShareSession {
  conversationId: string;
  userId: string;
  status: LiveLocationShareStatus;
  startedAt: string;
  expiresAt: string;
  stoppedAt?: string | null;
  lastHeartbeatAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Latest live location point for a user in a conversation.
 */
export interface LiveLocationPoint {
  conversationId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
  capturedAt: string;
  expiresAt: string;
  updatedAt: string;
}

/**
 * Emergency-contact live location sharing lifecycle state.
 */
export type EmergencyLiveLocationShareStatus = 'active' | 'stopped' | 'expired';

/**
 * Current user's emergency-contact live location sharing state per booking.
 */
export interface EmergencyLiveLocationShare {
  id: string;
  bookingId: string;
  userId: string;
  status: EmergencyLiveLocationShareStatus;
  startedAt: string;
  expiresAt: string;
  stoppedAt?: string | null;
  lastHeartbeatAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Latest emergency-contact live location point for a booking.
 */
export interface EmergencyLiveLocationPoint {
  shareId: string;
  bookingId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
  capturedAt: string;
  expiresAt: string;
  updatedAt: string;
}

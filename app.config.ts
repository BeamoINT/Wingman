import type { ExpoConfig } from 'expo/config';

const appEnv = process.env.EXPO_PUBLIC_APP_ENV || 'development';
const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID
  || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS
  || '';
const googleMapsApiKeyIos = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || googleMapsApiKey;
const googleMapsApiKeyAndroid = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || googleMapsApiKey;

const config: ExpoConfig = {
  name: 'Wingman',
  slug: 'wingman',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0A0F',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.wingman.app',
    config: {
      googleMapsApiKey: googleMapsApiKeyIos,
    },
    infoPlist: {
      UIBackgroundModes: ['fetch', 'remote-notification'],
      NSLocationWhenInUseUsageDescription:
        'Wingman needs your location to find companions near you and auto-fill your location during signup.',
      NSPhotoLibraryUsageDescription:
        'Wingman needs access to your photo library so you can send images and videos in encrypted chats.',
      NSPhotoLibraryAddUsageDescription:
        'Wingman needs permission to save selected media for secure encrypted uploads.',
      NSCameraUsageDescription:
        'Wingman needs camera access so you can capture images and videos in encrypted chats.',
      NSMicrophoneUsageDescription:
        'Wingman needs microphone access when you record video messages.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0A0F',
    },
    package: 'com.wingman.app',
    config: {
      googleMaps: {
        apiKey: googleMapsApiKeyAndroid,
      },
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA',
      'RECORD_AUDIO',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Wingman needs your location to find companions near you and auto-fill your location during signup.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Wingman needs photo library access so you can send encrypted images and videos.',
        cameraPermission: 'Wingman needs camera access so you can capture encrypted images and videos.',
        microphonePermission: 'Wingman needs microphone access when you record encrypted video messages.',
      },
    ],
  ],
  extra: {
    app_env: appEnv,
    supabase_url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    supabase_anon_key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    stripe_publishable_key: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    rc_api_key_ios: process.env.EXPO_PUBLIC_RC_API_KEY_IOS || '',
    rc_api_key_android: process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID || '',
    rc_entitlement_pro: process.env.EXPO_PUBLIC_RC_ENTITLEMENT_PRO || 'pro',
    rc_package_pro_monthly: process.env.EXPO_PUBLIC_RC_PACKAGE_PRO_MONTHLY || '$rc_monthly',
    rc_package_pro_yearly: process.env.EXPO_PUBLIC_RC_PACKAGE_PRO_YEARLY || '$rc_annual',
    google_maps_api_key: googleMapsApiKey,
    google_maps_api_key_ios: googleMapsApiKeyIos,
    google_maps_api_key_android: googleMapsApiKeyAndroid,
    sentry_dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    messages_v2_enabled: process.env.EXPO_PUBLIC_MESSAGES_V2_ENABLED || 'true',
    messages_media_enabled: process.env.EXPO_PUBLIC_MESSAGES_MEDIA_ENABLED || 'true',
    group_event_chat_enabled: process.env.EXPO_PUBLIC_GROUP_EVENT_CHAT_ENABLED || 'true',
    encrypted_report_enabled: process.env.EXPO_PUBLIC_ENCRYPTED_REPORT_ENABLED || 'true',
    friends_pro_model_enabled: process.env.EXPO_PUBLIC_FRIENDS_PRO_MODEL_ENABLED || 'true',
    friends_ranked_list_enabled: process.env.EXPO_PUBLIC_FRIENDS_RANKED_LIST_ENABLED || 'true',
    friends_connection_requests_enabled: process.env.EXPO_PUBLIC_FRIENDS_CONNECTION_REQUESTS_ENABLED || 'true',
    friends_matching_v4_enabled: process.env.EXPO_PUBLIC_FRIENDS_MATCHING_V4_ENABLED || 'true',
    friends_global_metro_enabled: process.env.EXPO_PUBLIC_FRIENDS_GLOBAL_METRO_ENABLED || 'true',
    friends_google_map_picker_enabled: process.env.EXPO_PUBLIC_FRIENDS_GOOGLE_MAP_PICKER_ENABLED || 'true',
    google_maps_cutover_enabled: process.env.EXPO_PUBLIC_GOOGLE_MAPS_CUTOVER_ENABLED || 'true',
    meetup_negotiation_enabled: process.env.EXPO_PUBLIC_MEETUP_NEGOTIATION_ENABLED || 'true',
  },
};

export default config;

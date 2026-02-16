# Wingman

> Never fly solo - Find friendly companions for social outings

Wingman is a modern iOS and Android app that connects people who want company for social activities. Whether you need a dining companion, someone to attend a concert with, or just want to feel safe at a bar, Wingman matches you with verified, background-checked companions.

## Features

### Companion Booking
- Browse verified companions in your area
- Book companions for various activities (dining, nightlife, movies, concerts, etc.)
- Real-time availability and instant booking
- Secure in-app messaging

### Safety First
- **Background Checks**: All companions undergo thorough background screening
- **ID Verification**: Multi-step identity verification process
- **Live Location Sharing**: Share your location with emergency contacts during bookings
- **Safety Check-ins**: Periodic prompts during bookings
- **24/7 Support**: Round-the-clock trust and safety team
- **Emergency SOS**: One-tap emergency alerts

### Friend Matching
- Pro subscription unlocks the full Friends experience
- Connect with like-minded people for genuine friendships (not dating)
- Group activities and exclusive events
- No pressure, organic connections

### Pro Features
- Ranked friend recommendations and request inbox
- Friends feed, groups, and events
- Encrypted media messaging support in app builds
- Priority product access for new social features

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation 6
- **Animations**: React Native Reanimated
- **Styling**: StyleSheet with custom theme system
- **Haptics**: Expo Haptics for tactile feedback
- **Icons**: Expo Vector Icons (Ionicons)

## Design System

### Color Palette
- **Monochrome Surfaces**: neutral light/dark semantic layers
- **Electric Blue Accent**: `#0A84FF` for primary actions and trust indicators
- **Token-driven States**: semantic success/warning/error colors

### Typography
- Manrope across all display/body roles
- Consistent sizing scale
- Accessibility-focused contrast ratios

### Haptic Feedback
- Light: Toggles, selections
- Medium: Button presses, card selections
- Heavy: Important actions
- Success/Error/Warning: Notifications
- Celebration: Achievements and milestones

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI / EAS CLI
- iOS Simulator (Mac) or Android Emulator
- Wingman development build installed on device/simulator for full functionality

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/wingman.git
cd wingman

# Install dependencies
npm install

# Start Metro for Wingman development build (default)
npm start
```

### Running the App

```bash
# Build and run development client
npm run ios:dev
npm run android:dev

# Web (preview)
npm run web

# Expo Go fallback (limited compatibility)
npm run start:go
```

## Runtime Notes

- Wingman is production-oriented and depends on native modules for purchases and secure media messaging.
- Full app behavior requires a Wingman development build or production build.
- Expo Go is intentionally limited and should only be used for basic fallback checks.

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── Avatar.tsx
│   ├── Badge.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── CompanionCard.tsx
│   ├── Header.tsx
│   ├── Input.tsx
│   ├── Rating.tsx
│   ├── SafetyBanner.tsx
│   └── SubscriptionCard.tsx
├── navigation/       # Navigation configuration
│   ├── MainTabNavigator.tsx
│   └── RootNavigator.tsx
├── screens/          # App screens
│   ├── BookingConfirmationScreen.tsx
│   ├── BookingScreen.tsx
│   ├── BookingsScreen.tsx
│   ├── ChatScreen.tsx
│   ├── CompanionProfileScreen.tsx
│   ├── DiscoverScreen.tsx
│   ├── HomeScreen.tsx
│   ├── MessagesScreen.tsx
│   ├── OnboardingScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── SafetyScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── SplashScreen.tsx
│   ├── SubscriptionScreen.tsx
│   └── VerificationScreen.tsx
├── theme/            # Design system
│   ├── colors.ts
│   ├── spacing.ts
│   └── typography.ts
├── types/            # TypeScript definitions
│   └── index.ts
└── utils/            # Utility functions
    ├── formatters.ts
    └── haptics.ts
```

## Screens

1. **Splash** - Animated logo and app launch
2. **Onboarding** - Feature introduction carousel
3. **Home** - Dashboard with featured companions and quick actions
4. **Discover** - Browse and filter companions
5. **Companion Profile** - Detailed companion information
6. **Booking** - Date, time, and activity selection
7. **Booking Confirmation** - Success screen with details
8. **Bookings** - Upcoming and past bookings
9. **Messages** - Conversation list
10. **Chat** - Individual conversation
11. **Profile** - User profile and settings access
12. **Subscription** - Plan selection and upgrade
13. **Safety** - Safety features and emergency contacts
14. **Verification** - ID and background check progress
15. **Settings** - App preferences and account

## License

This project is proprietary software. All rights reserved.

---

Built with care for those who never want to fly solo

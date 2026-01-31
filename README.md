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
- Subscription tiers include friend matching features
- Connect with like-minded people for genuine friendships (not dating)
- Group activities and exclusive events
- No pressure, organic connections

### Premium Features
- Unlimited bookings
- Priority companion matching
- Exclusive member events
- Concierge service (Elite tier)
- VIP companion access

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation 6
- **Animations**: React Native Reanimated
- **Styling**: StyleSheet with custom theme system
- **Haptics**: Expo Haptics for tactile feedback
- **Icons**: Expo Vector Icons (Ionicons)

## Design System

### Color Palette
- **Primary Black**: `#0A0A0F` - Main background
- **Light Blue/Teal**: `#4ECDC4` - Primary accent
- **Gold**: `#FFD700` - Premium/highlight accent

### Typography
- Clean, modern system fonts
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
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/wingman.git
cd wingman

# Install dependencies
npm install

# Start the development server
npm start
```

### Running the App

```bash
# iOS
npm run ios

# Android
npm run android

# Web (preview)
npm run web
```

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

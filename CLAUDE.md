# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wingman is a React Native mobile app (Expo 54, React Native 0.81, TypeScript strict mode) for booking verified social companions. Dark-mode-first UI with Supabase backend.

## Development Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run on web (preview only)
npm run lint       # ESLint all files
npm run format     # Prettier format all files
```

No test framework is currently configured.

## Path Aliases

Configured in both `tsconfig.json` and `babel.config.js` (must stay in sync):
- `@/` → `src/`
- `@components/`, `@screens/`, `@theme/`, `@utils/`, `@hooks/`, `@navigation/`, `@types/` → corresponding `src/` subdirectories

## Architecture

### Directory Structure

```
src/
├── components/          # Reusable UI (30+ components, variant-based)
│   ├── location/        # Location pickers
│   └── verification/    # Verification-specific components
├── screens/             # 40+ screens organized by feature
│   ├── auth/            # SignIn, Signup, email/phone verification
│   ├── tutorial/        # Onboarding flow
│   ├── verification/    # ID verification flow
│   ├── friends/         # Social features (subscription-gated)
│   └── legal/           # Terms, privacy, guidelines
├── navigation/          # RootNavigator (stack) + MainTabNavigator (6 bottom tabs)
├── context/             # Auth, Verification, Requirements, Network providers
├── theme/               # colors, spacing, typography
├── types/               # Central TypeScript definitions
├── utils/               # haptics, validation, formatters, animations, sanitize, apiErrors
├── hooks/               # useLocation, useNetworkStatus, usePlacesAutocomplete
├── services/            # Supabase config + API modules (bookings, companions, messages, etc.)
└── data/                # Country/region lookup data
```

### Navigation Flow

**Auth flow:** Welcome → SignIn/Signup → VerifyEmail → VerifyPhone → Tutorial → Main App

**Main tabs (6):** Home, Discover, Verification, Bookings, Messages, Profile

Protected routes use `withAuthGuard()` HOC. Navigation is fully typed via `RootStackParamList` and `MainTabParamList` in the types directory.

### State Management

Context API only (no Redux). Provider nesting order in App.tsx:
```
NetworkProvider → AuthProvider → VerificationProvider → RequirementsProvider
```

- **AuthContext** — Session, signup flow (multi-step data), Supabase auth, Apple auth, consent management
- **VerificationContext** — Progressive verification (email → phone → ID → background check)
- **RequirementsContext** — Feature gating based on verification status and subscription tier
- **NetworkContext** — Online/offline detection

Persistent storage: AsyncStorage for preferences, Expo SecureStore for sensitive data.

### Services Layer

`src/services/` contains Supabase client config and API modules: `bookingsApi`, `companions`, `locationApi`, `messages`, `profiles`, `verificationApi`, `phoneVerification`.

## Key Patterns

### Component Conventions

- All styling via `StyleSheet.create()` at bottom of file
- Components support variant props (e.g., Button: primary/secondary/outline/ghost/gold/danger)
- Interactive components use haptic feedback via `haptics.light()`, `haptics.medium()`, etc. from `@utils/haptics`
- Animations use React Native Reanimated 4 with spring physics

### Screen Structure

1. React/RN imports → External libs → Theme/Utils/Types
2. Navigation typed via `NativeStackNavigationProp<RootStackParamList, 'ScreenName'>`
3. Component with hooks → Render
4. `StyleSheet.create()` at bottom

### Theme Usage

Import from `@theme/`:
- `colors` — Dark palette (primary #0A0A0F, accent #00D4FF, premium gold #C0C0C0)
- `spacing` — Base units (xxs–massive) + semantic aliases (screenPadding, cardPadding, sectionGap)
- `typography` — Presets (hero, h1–h4, body, caption, button, label)

### Domain Types

Key enums/unions in `src/types/`:
- **VerificationLevel:** basic, verified, premium
- **BookingStatus:** pending, confirmed, in-progress, completed, cancelled, disputed
- **SubscriptionTier:** free, plus, premium, elite
- **CompanionSpecialty:** 14 activity types (dining, nightlife, sports, etc.)
- **Gender:** male, female, non-binary, other, prefer-not-to-say

### Validation

`src/utils/validation.ts` provides composable validators with `compose()`. Validators for email (RFC5322), password (8+ chars, uppercase, lowercase, number, special), phone (US format), name, date.

### Platform Handling

- Tab bar: 88px height iOS, 68px Android
- Typography uses system fonts per platform
- Safe area insets via `react-native-safe-area-context`
- BlurView for native blur effects

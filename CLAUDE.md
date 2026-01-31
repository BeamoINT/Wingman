# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wingman is a React Native mobile application (Expo 50) for booking verified social companions for activities like dining, nightlife, and events. Built with TypeScript in strict mode.

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

## Architecture

### Directory Structure

- `src/components/` - Reusable UI components with variant patterns (Button, Card, Avatar, etc.)
- `src/screens/` - Screen components (26+ screens)
- `src/navigation/` - React Navigation setup (RootNavigator with stack, MainTabNavigator with bottom tabs)
- `src/theme/` - Design system (colors, spacing, typography)
- `src/types/` - TypeScript interfaces (User, Companion, Booking, Message, etc.)
- `src/utils/` - Utilities (haptics, formatters, animations)

### Navigation Flow

`SplashScreen → OnboardingScreen → MainTabNavigator (Home, Discover, Bookings, Messages, Profile)`

### Path Aliases

Configured in tsconfig.json and babel.config.js:
- `@/` → `src/`
- `@components/` → `src/components/`
- `@screens/` → `src/screens/`
- `@theme/` → `src/theme/`
- `@utils/` → `src/utils/`
- `@navigation/` → `src/navigation/`
- `@types/` → `src/types/`

## Key Patterns

### Component Structure

Components use StyleSheet.create() with styles at bottom of file. Most components support variants:
- Button: primary, secondary, outline, ghost, gold, danger
- Card: default, elevated, outlined, gradient, premium

### Haptic Feedback

Interactive components integrate haptics via `haptics.light()`, `haptics.medium()`, etc. from `src/utils/haptics.ts`.

### Type Definitions

- Verification levels: basic, verified, background, premium
- Booking statuses: pending, confirmed, in-progress, completed, cancelled, disputed
- Subscription tiers: free, plus, premium, elite

### Theme System

Import from `src/theme/`:
- `colors` - Nested color palette (primary, background, text, status, gradients, shadows)
- `spacing` - Base units (xxs through massive) and semantic aliases (screenPadding, cardPadding)
- `typography` - Platform-specific fonts, sizes, weights, preset styles

### Screen Pattern

Screens follow this structure:
1. React/RN imports
2. Navigation hooks and typed props
3. Theme and utility imports
4. Components
5. Mock data (currently hardcoded)
6. Functional component with hooks
7. StyleSheet at bottom

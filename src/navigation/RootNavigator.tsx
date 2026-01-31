import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types';

// Auth Screens
import { SplashScreen } from '../screens/SplashScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { TutorialScreen } from '../screens/tutorial/TutorialScreen';

// Main App Screens
import { MainTabNavigator } from './MainTabNavigator';
import { CompanionProfileScreen } from '../screens/CompanionProfileScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { SafetyScreen } from '../screens/SafetyScreen';
import { VerificationScreen } from '../screens/VerificationScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.primary },
          animation: 'slide_from_right',
        }}
      >
        {/* Auth Flow */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Tutorial" component={TutorialScreen} />

        {/* Main App */}
        <Stack.Screen name="Main" component={MainTabNavigator} />
        <Stack.Screen
          name="CompanionProfile"
          component={CompanionProfileScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Booking"
          component={BookingScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="BookingConfirmation"
          component={BookingConfirmationScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Safety" component={SafetyScreen} />
        <Stack.Screen name="Verification" component={VerificationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

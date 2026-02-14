import React, { useEffect, useCallback } from 'react';
import { NavigationContainer, useNavigation, useNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../types';

// Auth Screens
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { VerifyPhoneScreen } from '../screens/auth/VerifyPhoneScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { MagicLinkLoginScreen } from '../screens/auth/MagicLinkLoginScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { ChangeEmailScreen } from '../screens/auth/ChangeEmailScreen';
import { TutorialScreen } from '../screens/tutorial/TutorialScreen';

// Main App Screens
import { MainTabNavigator } from './MainTabNavigator';
import { CompanionProfileScreen } from '../screens/CompanionProfileScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { SafetyScreen } from '../screens/SafetyScreen';
import { VerificationScreen } from '../screens/VerificationScreen';
import {
  VerificationHistoryScreen,
  VerificationPreferencesScreen,
} from '../screens/verification';

// Friends Feature Screens
import {
  FriendsScreen,
  FriendMatchingScreen,
  SocialFeedScreen,
  GroupsScreen,
  EventsScreen,
} from '../screens/friends';

// Companion Screens
import {
  CompanionOnboardingScreen,
  CompanionApplicationStatusScreen,
} from '../screens/companion';
import { CompanionDashboardScreen } from '../screens/CompanionDashboardScreen';

// Legal Screens
import { LegalDocumentScreen } from '../screens/legal';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth Guard HOC - Wraps a screen component and redirects to Welcome if not authenticated
 */
const withAuthGuard = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string
): React.FC<P> => {
  const AuthGuardedComponent: React.FC<P> = (props) => {
    const { isAuthenticated } = useAuth();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    useEffect(() => {
      if (!isAuthenticated) {
        // Reset navigation to Welcome screen when accessing protected route while unauthenticated
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          })
        );
      }
    }, [isAuthenticated, navigation]);

    // Don't render the protected screen if not authenticated
    if (!isAuthenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  AuthGuardedComponent.displayName = `AuthGuard(${screenName})`;
  return AuthGuardedComponent;
};

// Create auth-guarded versions of protected screens
const ProtectedMainTabNavigator = withAuthGuard(MainTabNavigator, 'Main');
const ProtectedCompanionProfileScreen = withAuthGuard(CompanionProfileScreen, 'CompanionProfile');
const ProtectedBookingScreen = withAuthGuard(BookingScreen, 'Booking');
const ProtectedBookingConfirmationScreen = withAuthGuard(BookingConfirmationScreen, 'BookingConfirmation');
const ProtectedChatScreen = withAuthGuard(ChatScreen, 'Chat');
const ProtectedSettingsScreen = withAuthGuard(SettingsScreen, 'Settings');
const ProtectedSubscriptionScreen = withAuthGuard(SubscriptionScreen, 'Subscription');
const ProtectedSafetyScreen = withAuthGuard(SafetyScreen, 'Safety');
const ProtectedVerificationScreen = withAuthGuard(VerificationScreen, 'Verification');
const ProtectedVerificationHistoryScreen = withAuthGuard(VerificationHistoryScreen, 'VerificationHistory');
const ProtectedVerificationPreferencesScreen = withAuthGuard(VerificationPreferencesScreen, 'VerificationPreferences');
const ProtectedChangePasswordScreen = withAuthGuard(ChangePasswordScreen, 'ChangePassword');
const ProtectedChangeEmailScreen = withAuthGuard(ChangeEmailScreen, 'ChangeEmail');
const ProtectedNotificationsScreen = withAuthGuard(NotificationsScreen, 'Notifications');

// Companion Feature - Protected
const ProtectedCompanionOnboardingScreen = withAuthGuard(CompanionOnboardingScreen, 'CompanionOnboarding');
const ProtectedCompanionApplicationStatusScreen = withAuthGuard(CompanionApplicationStatusScreen, 'CompanionApplicationStatus');
const ProtectedCompanionDashboardScreen = withAuthGuard(CompanionDashboardScreen, 'CompanionDashboard');

// Friends Feature - Protected
const ProtectedFriendsScreen = withAuthGuard(FriendsScreen, 'Friends');
const ProtectedFriendMatchingScreen = withAuthGuard(FriendMatchingScreen, 'FriendMatching');
const ProtectedSocialFeedScreen = withAuthGuard(SocialFeedScreen, 'SocialFeed');
const ProtectedGroupsScreen = withAuthGuard(GroupsScreen, 'Groups');
const ProtectedEventsScreen = withAuthGuard(EventsScreen, 'Events');

export const RootNavigator: React.FC = () => {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const { isAuthenticated, signupDraftStep } = useAuth();

  // Auto-navigate based on auth state when navigation is ready
  const handleNavigationReady = useCallback(() => {
    if (!navigationRef.isReady()) return;

    if (isAuthenticated) {
      // User has an active session — go straight to Main
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        })
      );
    } else if (signupDraftStep != null) {
      // Resume in-progress signup
      navigationRef.dispatch(
        CommonActions.navigate({
          name: 'Signup',
          params: { resumeStep: signupDraftStep },
        })
      );
    }
  }, [isAuthenticated, signupDraftStep, navigationRef]);

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.primary },
          animation: 'slide_from_right',
        }}
      >
        {/* Auth Flow - Public Screens */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="VerifyPhone" component={VerifyPhoneScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="MagicLinkLogin" component={MagicLinkLoginScreen} />
        <Stack.Screen name="Tutorial" component={TutorialScreen} />

        {/* Main App - Protected Screens */}
        <Stack.Screen name="Main" component={ProtectedMainTabNavigator} />
        <Stack.Screen
          name="CompanionProfile"
          component={ProtectedCompanionProfileScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Booking"
          component={ProtectedBookingScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="BookingConfirmation"
          component={ProtectedBookingConfirmationScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="Chat" component={ProtectedChatScreen} />
        <Stack.Screen name="Settings" component={ProtectedSettingsScreen} />
        <Stack.Screen name="ChangePassword" component={ProtectedChangePasswordScreen} />
        <Stack.Screen name="ChangeEmail" component={ProtectedChangeEmailScreen} />
        <Stack.Screen
          name="Subscription"
          component={ProtectedSubscriptionScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Notifications" component={ProtectedNotificationsScreen} />
        <Stack.Screen name="Safety" component={ProtectedSafetyScreen} />
        <Stack.Screen name="Verification" component={ProtectedVerificationScreen} />

        {/* Verification Sub-Screens - Protected */}
        <Stack.Screen name="VerificationHistory" component={ProtectedVerificationHistoryScreen} />
        <Stack.Screen name="VerificationPreferences" component={ProtectedVerificationPreferencesScreen} />

        {/* Friends Feature - Protected */}
        <Stack.Screen
          name="Friends"
          component={ProtectedFriendsScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="FriendMatching" component={ProtectedFriendMatchingScreen} />
        <Stack.Screen name="SocialFeed" component={ProtectedSocialFeedScreen} />
        <Stack.Screen name="Groups" component={ProtectedGroupsScreen} />
        <Stack.Screen name="Events" component={ProtectedEventsScreen} />

        {/* Companion Feature - Protected */}
        <Stack.Screen name="CompanionOnboarding" component={ProtectedCompanionOnboardingScreen} />
        <Stack.Screen name="CompanionApplicationStatus" component={ProtectedCompanionApplicationStatusScreen} />
        <Stack.Screen name="CompanionDashboard" component={ProtectedCompanionDashboardScreen} />

        {/* Legal Screens - Public (accessible during signup flow) */}
        <Stack.Screen
          name="LegalDocument"
          component={LegalDocumentScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

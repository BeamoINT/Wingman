import { CommonActions, NavigationContainer, useNavigation, useNavigationContainerRef } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { reportNavigationRoute } from '../services/monitoring/sentry';
import type { RootStackParamList } from '../types';

// Auth Screens
import { ChangeEmailScreen } from '../screens/auth/ChangeEmailScreen';
import { ChangePasswordScreen } from '../screens/auth/ChangePasswordScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { MagicLinkLoginScreen } from '../screens/auth/MagicLinkLoginScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { VerifyPhoneScreen } from '../screens/auth/VerifyPhoneScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { TutorialScreen } from '../screens/tutorial/TutorialScreen';

// Main App Screens
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { BlockedUsersScreen } from '../screens/BlockedUsersScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { CompanionProfileScreen } from '../screens/CompanionProfileScreen';
import { DirectionsScreen } from '../screens/DirectionsScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { MetroMapPickerScreen } from '../screens/MetroMapPickerScreen';
import { MetroPreferencesScreen } from '../screens/MetroPreferencesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SafetyScreen } from '../screens/SafetyScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import {
  VerificationHistoryScreen,
} from '../screens/verification';
import { VerificationScreen } from '../screens/VerificationScreen';
import { MainTabNavigator } from './MainTabNavigator';

// Friends Feature Screens
import {
  EventsScreen, FriendMatchingScreen, FriendRequestsScreen, FriendsScreen, GroupsScreen, SocialFeedScreen,
} from '../screens/friends';

// Companion Screens
import {
  CompanionAgreementScreen,
  CompanionApplicationStatusScreen,
  CompanionOnboardingScreen,
  WingmanProfileSetupScreen,
} from '../screens/companion';
import { CompanionDashboardScreen } from '../screens/CompanionDashboardScreen';

// Legal Screens
import { LegalDocumentScreen } from '../screens/legal';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth Guard HOC - Wraps a screen component and redirects to Welcome if not authenticated.
 */
const withAuthGuard = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string,
): React.FC<P> => {
  const AuthGuardedComponent: React.FC<P> = (props) => {
    const { isAuthenticated } = useAuth();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    useEffect(() => {
      if (!isAuthenticated) {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          }),
        );
      }
    }, [isAuthenticated, navigation]);

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
const ProtectedDirectionsScreen = withAuthGuard(DirectionsScreen, 'Directions');
const ProtectedSettingsScreen = withAuthGuard(SettingsScreen, 'Settings');
const ProtectedBlockedUsersScreen = withAuthGuard(BlockedUsersScreen, 'BlockedUsers');
const ProtectedSubscriptionScreen = withAuthGuard(SubscriptionScreen, 'Subscription');
const ProtectedSafetyScreen = withAuthGuard(SafetyScreen, 'Safety');
const ProtectedVerificationScreen = withAuthGuard(VerificationScreen, 'Verification');
const ProtectedVerificationHistoryScreen = withAuthGuard(VerificationHistoryScreen, 'VerificationHistory');
const ProtectedChangePasswordScreen = withAuthGuard(ChangePasswordScreen, 'ChangePassword');
const ProtectedChangeEmailScreen = withAuthGuard(ChangeEmailScreen, 'ChangeEmail');
const ProtectedEditProfileScreen = withAuthGuard(EditProfileScreen, 'EditProfile');
const ProtectedNotificationsScreen = withAuthGuard(NotificationsScreen, 'Notifications');
const ProtectedMetroPreferencesScreen = withAuthGuard(MetroPreferencesScreen, 'MetroPreferences');
const ProtectedMetroMapPickerScreen = withAuthGuard(MetroMapPickerScreen, 'MetroMapPicker');

// Companion Feature - Protected
const ProtectedCompanionOnboardingScreen = withAuthGuard(CompanionOnboardingScreen, 'CompanionOnboarding');
const ProtectedCompanionAgreementScreen = withAuthGuard(CompanionAgreementScreen, 'CompanionAgreement');
const ProtectedWingmanProfileSetupScreen = withAuthGuard(WingmanProfileSetupScreen, 'WingmanProfileSetup');
const ProtectedCompanionApplicationStatusScreen = withAuthGuard(CompanionApplicationStatusScreen, 'CompanionApplicationStatus');
const ProtectedCompanionDashboardScreen = withAuthGuard(CompanionDashboardScreen, 'CompanionDashboard');

// Friends Feature - Protected
const ProtectedFriendsScreen = withAuthGuard(FriendsScreen, 'Friends');
const ProtectedFriendMatchingScreen = withAuthGuard(FriendMatchingScreen, 'FriendMatching');
const ProtectedFriendRequestsScreen = withAuthGuard(FriendRequestsScreen, 'FriendRequests');
const ProtectedSocialFeedScreen = withAuthGuard(SocialFeedScreen, 'SocialFeed');
const ProtectedGroupsScreen = withAuthGuard(GroupsScreen, 'Groups');
const ProtectedEventsScreen = withAuthGuard(EventsScreen, 'Events');

export const RootNavigator: React.FC = () => {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const { isAuthenticated, signupDraftStep } = useAuth();
  const { tokens, reduceMotionEnabled } = useTheme();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    if (!isNavigationReady || !navigationRef.isReady()) {
      return;
    }

    const currentRouteName = navigationRef.getCurrentRoute()?.name;
    const authRoutes = new Set<string>([
      'Welcome',
      'SignIn',
      'Signup',
      'VerifyEmail',
      'VerifyPhone',
      'ForgotPassword',
      'MagicLinkLogin',
      'Tutorial',
      'LegalDocument',
    ]);

    if (isAuthenticated) {
      const allowedAuthRoutes = new Set<string>([
        'Main',
        'VerifyEmail',
        'VerifyPhone',
        'Tutorial',
        'LegalDocument',
      ]);

      if (!currentRouteName || !allowedAuthRoutes.has(currentRouteName)) {
        navigationRef.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          }),
        );
      }
      return;
    }

    if (signupDraftStep != null) {
      if (currentRouteName !== 'Signup') {
        navigationRef.dispatch(
          CommonActions.navigate({
            name: 'Signup',
            params: { resumeStep: signupDraftStep },
          }),
        );
      }
      return;
    }

    if (!currentRouteName || !authRoutes.has(currentRouteName)) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        }),
      );
    }
  }, [isNavigationReady, isAuthenticated, signupDraftStep, navigationRef]);

  const defaultAnimation = reduceMotionEnabled ? 'none' : 'slide_from_right';
  const modalAnimation = reduceMotionEnabled ? 'none' : 'slide_from_bottom';

  const handleNavigationReady = () => {
    setIsNavigationReady(true);
    reportNavigationRoute(navigationRef.getCurrentRoute()?.name || 'unknown');
  };

  const handleNavigationStateChange = () => {
    reportNavigationRoute(navigationRef.getCurrentRoute()?.name || 'unknown');
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={handleNavigationReady}
      onStateChange={handleNavigationStateChange}
    >
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.colors.background.primary },
          animation: defaultAnimation,
          animationDuration: reduceMotionEnabled ? 0 : tokens.motion.duration.normal,
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
          options={{ animation: modalAnimation }}
        />
        <Stack.Screen
          name="Booking"
          component={ProtectedBookingScreen}
          options={{ animation: modalAnimation }}
        />
        <Stack.Screen
          name="BookingConfirmation"
          component={ProtectedBookingConfirmationScreen}
          options={{ animation: reduceMotionEnabled ? 'none' : 'fade' }}
        />
        <Stack.Screen name="Chat" component={ProtectedChatScreen} />
        <Stack.Screen
          name="Directions"
          component={ProtectedDirectionsScreen}
          options={{ animation: modalAnimation }}
        />
        <Stack.Screen name="EditProfile" component={ProtectedEditProfileScreen} />
        <Stack.Screen name="Settings" component={ProtectedSettingsScreen} />
        <Stack.Screen name="BlockedUsers" component={ProtectedBlockedUsersScreen} />
        <Stack.Screen name="MetroPreferences" component={ProtectedMetroPreferencesScreen} />
        <Stack.Screen
          name="MetroMapPicker"
          component={ProtectedMetroMapPickerScreen}
          options={{ animation: modalAnimation }}
        />
        <Stack.Screen name="ChangePassword" component={ProtectedChangePasswordScreen} />
        <Stack.Screen name="ChangeEmail" component={ProtectedChangeEmailScreen} />
        <Stack.Screen
          name="Subscription"
          component={ProtectedSubscriptionScreen}
          options={{ animation: modalAnimation }}
        />
        <Stack.Screen name="Notifications" component={ProtectedNotificationsScreen} />
        <Stack.Screen name="Safety" component={ProtectedSafetyScreen} />
        <Stack.Screen name="Verification" component={ProtectedVerificationScreen} />

        {/* Verification Sub-Screens - Protected */}
        <Stack.Screen name="VerificationHistory" component={ProtectedVerificationHistoryScreen} />

        {/* Friends Feature - Protected */}
        <Stack.Screen
          name="Friends"
          component={ProtectedFriendsScreen}
          options={{ animation: modalAnimation }}
        />
        <Stack.Screen name="FriendMatching" component={ProtectedFriendMatchingScreen} />
        <Stack.Screen name="FriendRequests" component={ProtectedFriendRequestsScreen} />
        <Stack.Screen name="SocialFeed" component={ProtectedSocialFeedScreen} />
        <Stack.Screen name="Groups" component={ProtectedGroupsScreen} />
        <Stack.Screen name="Events" component={ProtectedEventsScreen} />

        {/* Companion Feature - Protected */}
        <Stack.Screen name="CompanionOnboarding" component={ProtectedCompanionOnboardingScreen} />
        <Stack.Screen
          name="CompanionAgreement"
          component={ProtectedCompanionAgreementScreen}
          options={{ animation: modalAnimation }}
        />
        <Stack.Screen
          name="WingmanProfileSetup"
          component={ProtectedWingmanProfileSetupScreen}
          options={{ animation: modalAnimation }}
        />
        <Stack.Screen name="CompanionApplicationStatus" component={ProtectedCompanionApplicationStatusScreen} />
        <Stack.Screen name="CompanionDashboard" component={ProtectedCompanionDashboardScreen} />

        {/* Legal Screens - Public (accessible during signup flow) */}
        <Stack.Screen
          name="LegalDocument"
          component={LegalDocumentScreen}
          options={{ animation: modalAnimation }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

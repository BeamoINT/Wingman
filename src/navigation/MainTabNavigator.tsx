import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { MainTabParamList } from '../types';
import { haptics } from '../utils/haptics';

// Screens
import { BookingsScreen } from '../screens/BookingsScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { VerificationTabScreen } from '../screens/verification/VerificationTabScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const { tokens } = useTheme();
  const { colors } = tokens;

  const styles = StyleSheet.create({
    tabBar: {
      position: 'absolute',
      left: spacing.sm,
      right: spacing.sm,
      bottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
      borderRadius: spacing.radius.xxl,
      borderTopWidth: 0,
      height: Platform.OS === 'ios' ? 76 : 70,
      paddingTop: spacing.xs,
      paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
      backgroundColor: 'transparent',
      elevation: 0,
      shadowOpacity: 0,
      overflow: 'hidden',
    },
    tabBarLabel: {
      ...typography.presets.caption,
      fontSize: 11,
      lineHeight: 14,
      marginTop: 0,
      marginBottom: Platform.OS === 'ios' ? 0 : 2,
      fontFamily: typography.fontFamily.medium,
    },
    activeIconContainer: {
      backgroundColor: colors.accent.soft,
      borderColor: colors.border.light,
      borderWidth: 1,
      borderRadius: spacing.radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      marginTop: -1,
    },
  });

  const TabBarBackground = () => {
    if (Platform.OS === 'web') {
      return (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.surface.level1,
              borderWidth: 1,
              borderColor: colors.border.light,
            },
          ]}
        />
      );
    }

    return (
      <BlurView
        intensity={85}
        tint={tokens.isDark ? 'dark' : 'light'}
        style={[
          StyleSheet.absoluteFill,
          {
            borderWidth: 1,
            borderColor: colors.border.light,
            backgroundColor: tokens.isDark ? colors.surface.overlay : colors.surface.level1,
          },
        ]}
      />
    );
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: styles.tabBar,
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Discover':
              iconName = focused ? 'compass' : 'compass-outline';
              break;
            case 'Verification':
              iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
              break;
            case 'Bookings':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Messages':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return (
            <View style={focused ? styles.activeIconContainer : undefined}>
              <Ionicons name={iconName} size={20} color={color} />
            </View>
          );
        },
      })}
      screenListeners={{
        tabPress: () => {
          haptics.tabSwitch();
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Verification" component={VerificationTabScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

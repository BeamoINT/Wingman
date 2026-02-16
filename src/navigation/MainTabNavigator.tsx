import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { MainTabParamList } from '../types';
import { haptics } from '../utils/haptics';

// Screens
import { BookingsScreen } from '../screens/BookingsScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { FriendsScreen } from '../screens/friends';
import { HomeScreen } from '../screens/HomeScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;

  const styles = StyleSheet.create({
    tabBar: {
      position: 'absolute',
      left: spacing.sm,
      right: spacing.sm,
      bottom: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
      borderRadius: spacing.radius.lg,
      borderTopWidth: 1,
      borderWidth: 1,
      borderColor: colors.border.light,
      height: Platform.OS === 'ios' ? 64 : 60,
      paddingTop: spacing.xs,
      paddingBottom: Platform.OS === 'ios' ? spacing.xs : spacing.xxs,
      backgroundColor: colors.surface.level1,
      ...spacing.elevation.md,
      shadowColor: colors.shadow.medium,
    },
    tabBarLabel: {
      ...typography.presets.caption,
      fontSize: 11,
      lineHeight: 13,
      marginTop: 0,
      marginBottom: 0,
      fontFamily: typography.fontFamily.medium,
      letterSpacing: 0.1,
    },
    activeIconContainer: {
      backgroundColor: colors.accent.soft,
      borderRadius: spacing.radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      marginTop: -2,
      borderTopWidth: 2,
      borderTopColor: colors.accent.primary,
    },
  });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: styles.tabBar,
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
            case 'Friends':
              iconName = focused ? 'people' : 'people-outline';
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
              <Ionicons name={iconName} size={19} color={color} />
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
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

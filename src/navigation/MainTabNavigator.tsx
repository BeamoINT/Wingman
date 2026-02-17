import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { colors, spacing } = tokens;
  const insets = useSafeAreaInsets();

  const tabBarTopPadding = spacing.xxs;
  const tabBarBottomPadding = insets.bottom > 0
    ? Math.max(spacing.sm, Math.min(insets.bottom - spacing.xs, spacing.lg))
    : spacing.xs;
  const tabBarHeight = 34 + tabBarTopPadding + tabBarBottomPadding;

  const styles = StyleSheet.create({
    tabBar: {
      position: 'relative',
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 0,
      borderTopWidth: 1,
      borderColor: colors.border.light,
      height: tabBarHeight,
      paddingTop: tabBarTopPadding,
      paddingBottom: tabBarBottomPadding,
      backgroundColor: colors.surface.level1,
    },
    tabBarItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeIconContainer: {
      backgroundColor: colors.surface.level2,
      borderRadius: spacing.radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.accent.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 34,
    },
  });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
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

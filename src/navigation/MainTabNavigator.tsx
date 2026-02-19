import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import type { MainTabParamList } from '../types';
import { haptics } from '../utils/haptics';

// Screens
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const insets = useSafeAreaInsets();

  const tabBarTopPadding = spacing.xs;
  const tabBarBottomPadding = insets.bottom > 0
    ? Math.max(spacing.sm, Math.min(insets.bottom - spacing.xs, spacing.lg))
    : spacing.sm;
  const tabBarHeight = 56 + tabBarTopPadding + tabBarBottomPadding;

  const styles = StyleSheet.create({
    tabBar: {
      position: 'relative',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: 1,
      borderColor: colors.border.light,
      height: tabBarHeight,
      paddingTop: tabBarTopPadding,
      paddingBottom: tabBarBottomPadding,
      backgroundColor: colors.surface.level1,
      shadowColor: colors.shadow.light,
      ...spacing.elevation.sm,
    },
    tabBarItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    tabBarButton: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
    },
    tabBarButtonContent: {
      minHeight: 40,
      minWidth: 76,
      borderRadius: spacing.radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBarButtonContentActive: {
      backgroundColor: colors.surface.level2,
      borderWidth: 1,
      borderColor: colors.accent.primary,
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
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          marginTop: 2,
          fontSize: typography.sizes.xs,
          fontWeight: String(typography.weights.semibold) as any,
          includeFontPadding: false,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        tabBarHideOnKeyboard: true,
        tabBarButton: (props) => {
          const focused = props.accessibilityState?.selected ?? false;
          return (
            <TouchableOpacity
              {...props}
              style={[props.style, styles.tabBarButton]}
              activeOpacity={0.85}
            >
              <View style={[
                styles.tabBarButtonContent,
                focused ? styles.tabBarButtonContentActive : undefined,
              ]}
              >
                {props.children}
              </View>
            </TouchableOpacity>
          );
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Discover':
              iconName = focused ? 'compass' : 'compass-outline';
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

          return <Ionicons name={iconName} size={22} color={color} />;
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
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

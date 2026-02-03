/**
 * Lintnotes
 * - Purpose: Tab navigator layout configuring the two primary tabs and shared tab UI styling.
 *            Supports adaptive navigation: side tabs for landscape iPad (when logged in), bottom tabs otherwise.
 * - Exports: default TabsLayout (React component)
 * - Major deps: expo-router Tabs, @expo/vector-icons/Ionicons, hooks/useDeviceLayout, hooks/useSupabase
 * - Side effects: None (navigation configuration only).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { useSupabase } from '../../hooks/useSupabase';

export default function TabsLayout() {
  const { isTablet, isLandscape } = useDeviceLayout();
  const { session } = useSupabase();

  const isLoggedIn = !!session;
  const isLandscapeTablet = isTablet && isLandscape;

  // Side nav: only for landscape tablet when logged in
  // Otherwise: bottom tabs (or hidden in landscape when logged out)
  const useSideNav = isLandscapeTablet && isLoggedIn;

  // Hide tabs entirely in landscape when logged out (wastes space, does nothing)
  const hideTabs = isLandscapeTablet && !isLoggedIn;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f5cb08',
        tabBarInactiveTintColor: '#9c9c9c',
        tabBarPosition: useSideNav ? 'left' : 'bottom',
        tabBarVariant: useSideNav ? 'material' : 'uikit',
        tabBarShowLabel: !useSideNav,
        tabBarLabelPosition: useSideNav ? 'below-icon' : undefined,
        tabBarStyle: hideTabs
          ? { display: 'none' }
          : useSideNav
            ? {
                backgroundColor: '#1f1f1f',
                borderRightColor: '#2b2b2b',
                borderRightWidth: 1,
                width: 72,
                minWidth: 72,
                maxWidth: 72,
                paddingTop: 20,
              }
            : {
                backgroundColor: '#1f1f1f',
                borderTopColor: '#2b2b2b',
              },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIconStyle: useSideNav
          ? {
              marginBottom: 0,
            }
          : undefined,
        headerTintColor: '#1f1f1f',
        headerStyle: {
          backgroundColor: '#fdfdfd',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Check-In',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          )
        }}
      />
    </Tabs>
  );
}

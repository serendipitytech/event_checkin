/**
 * Lintnotes
 * - Purpose: Tab navigator layout configuring the two primary tabs and shared tab UI styling.
 * - Exports: default TabsLayout (React component)
 * - Major deps: expo-router Tabs, @expo/vector-icons/Ionicons
 * - Side effects: None (navigation configuration only).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f5cb08',
        tabBarInactiveTintColor: '#9c9c9c',
        tabBarStyle: {
          backgroundColor: '#1f1f1f',
          borderTopColor: '#2b2b2b'
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600'
        },
        headerTintColor: '#1f1f1f',
        headerStyle: {
          backgroundColor: '#fdfdfd'
        }
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

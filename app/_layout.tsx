/**
 * Lintnotes
 * - Purpose: Root layout for the Expo Router app. Wraps the navigation stack with global providers and gesture handler.
 * - Exports: default RootLayout (React component)
 * - Major deps: expo-router Stack, expo-status-bar, react-native-gesture-handler, SupabaseProvider (local context)
 * - Side effects: Initializes a no-op useEffect placeholder; otherwise none. Sets StatusBar style and defines stack screens.
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SupabaseProvider } from '../contexts/SupabaseContext';

export default function RootLayout() {
  useEffect(() => {
    // Place global side effects here such as warm-up fetches or font loading.
  }, []);

  return (
    <SupabaseProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </GestureHandlerRootView>
    </SupabaseProvider>
  );
}

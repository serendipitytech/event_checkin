/**
 * Lintnotes
 * - Purpose: Root layout for the Expo Router app. Wraps the navigation stack with global providers and gesture handler.
 * - Exports: default RootLayout (React component)
 * - Major deps: expo-router Stack, expo-status-bar, react-native-gesture-handler, SupabaseProvider (local context)
 * - Side effects: Initializes a no-op useEffect placeholder; otherwise none. Sets StatusBar style and defines stack screens.
 */
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, StyleSheet } from 'react-native';

import { SupabaseProvider } from '../contexts/SupabaseContext';
import { validateEnv } from '../src/utils/validateEnv';

// --- Environment Debug Banner ---
// Lintnotes
// - Purpose: Visual + console summary of environment and redirect URL for quick verification during dev/test.
// - Side effects: Console logging of non-secret environment values on mount.
const envSummary = {
  env: process.env.EXPO_PUBLIC_ENV,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  redirectUrl: process.env.EXPO_PUBLIC_REDIRECT_URL,
};

export function EnvironmentBanner() {
  console.log('=== ENVIRONMENT DEBUG ===');
  console.log(envSummary);

  return (
    <View style={envStyles.banner}>
      <Text style={envStyles.text}>🌎 {(envSummary.env || 'unknown').toString().toUpperCase()} MODE</Text>
      {!!envSummary.redirectUrl && <Text style={envStyles.small}>🔗 {envSummary.redirectUrl}</Text>}
    </View>
  );
}

const envStyles = StyleSheet.create({
  banner: {
    backgroundColor: '#222',
    padding: 8,
  },
  text: {
    color: '#00FF88',
    fontSize: 16,
    fontWeight: '600',
  },
  small: {
    color: '#aaa',
    fontSize: 10,
  },
});

export default function RootLayout() {
  useEffect(() => {
    // Place global side effects here such as warm-up fetches or font loading.
  }, []);

  const hideBanner = (envSummary.env || '').toLowerCase() === 'production';

  return (
    <>
      {!hideBanner && <EnvironmentBanner />}
      <SupabaseProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </GestureHandlerRootView>
      </SupabaseProvider>
    </>
  );
}
// Validate environment variables on module load
validateEnv();

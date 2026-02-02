/**
 * Lintnotes
 * - Purpose: Root layout for the Expo Router app. Wraps the navigation stack with global providers and gesture handler.
 * - Exports: default RootLayout (React component)
 * - Major deps: expo-router Stack, expo-status-bar, react-native-gesture-handler, SupabaseProvider (local context)
 * - Side effects: Initializes a no-op useEffect placeholder; otherwise none. Sets StatusBar style and defines stack screens.
 */
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, StyleSheet, SafeAreaView, Platform, AppState } from 'react-native';

import { SupabaseProvider } from '../contexts/SupabaseContext';
import { validateEnv } from '../src/utils/validateEnv';
import { initSyncManager } from '../services/syncManager';

// Validate environment variables on module load
validateEnv();

// --- Environment Debug Banner ---
// Lintnotes
// - Purpose: Visual + console summary of environment and redirect URL for quick verification during dev/test.
// - Side effects: Uses AppState to auto-hide when background; hides in production.
export function EnvironmentBanner() {
  const env = process.env.EXPO_PUBLIC_ENV;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const redirectUrl = process.env.EXPO_PUBLIC_REDIRECT_URL;
  const hideBanner = true;

  const [visible, setVisible] = useState(true);

  // Hide banner in production or when app goes background (proxy for screenshots/recording constraints)
  useEffect(() => {
    if (env === 'production') {
      setVisible(false);
      return;
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') setVisible(false);
      if (state === 'active') setVisible(true);
    });

    return () => sub.remove();
  }, [env]);

  if (!visible) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.envText}>🌍 {(env || 'unknown').toUpperCase()} MODE</Text>
        {redirectUrl ? (
          <Text style={styles.subtext} numberOfLines={1}>
            {redirectUrl}
          </Text>
        ) : (
          <Text style={styles.subtextMissing}>⚠️ Missing redirect URL</Text>
        )}
        {supabaseUrl && (
          <Text style={styles.subtext} numberOfLines={1}>
            {supabaseUrl}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  banner: {
    paddingTop: Platform.OS === 'ios' ? 4 : 0,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  envText: {
    color: '#00FF00',
    fontWeight: 'bold',
    fontSize: 12,
  },
  subtext: {
    color: '#ffffff',
    fontSize: 10,
  },
  subtextMissing: {
    color: '#ff6666',
    fontSize: 10,
    fontStyle: 'italic',
  },
});

export default function RootLayout() {
  useEffect(() => {
    // Initialize the sync manager for offline queue processing
    let cleanup: (() => void) | undefined;

    const initOffline = async () => {
      try {
        cleanup = await initSyncManager();
        console.log('🔄 Sync manager initialized');
      } catch (error) {
        console.error('Failed to initialize sync manager:', error);
      }
    };

    initOffline();

    return () => {
      cleanup?.();
    };
  }, []);

  const hideBanner =
  (process.env.EXPO_PUBLIC_ENV || '').toLowerCase() === 'production' ||
  process.env.EXPO_PUBLIC_HIDE_BANNER === 'true';

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

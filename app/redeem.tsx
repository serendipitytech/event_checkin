/**
 * Lintnotes
 * - Purpose: Deep link handler route for access code redemption URLs.
 *            Captures code from URL params and redirects to admin tab where
 *            the code redemption modal will be triggered.
 * - Exports: default RedeemScreen (React component)
 * - Major deps: expo-router
 * - Side effects: Stores pending code in async storage and redirects.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_CODE_KEY = '@checkin_pending_code';

export default function RedeemScreen() {
  const { code, event } = useLocalSearchParams<{ code?: string; event?: string }>();
  const router = useRouter();

  useEffect(() => {
    const handleRedeem = async () => {
      if (code) {
        // Store the pending code so the admin tab can pick it up
        await AsyncStorage.setItem(
          PENDING_CODE_KEY,
          JSON.stringify({ code, eventId: event ?? null })
        );
        console.log('Stored pending code for redemption:', code);
      }

      // Redirect to admin tab where the code modal can be triggered
      router.replace('/(tabs)/admin');
    };

    handleRedeem();
  }, [code, event, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007aff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f5f7',
  },
});

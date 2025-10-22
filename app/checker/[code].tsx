import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { validateCheckerLink } from '@/services/checkerLinks';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import SafeAsyncStorage from '@/utils/safeAsyncStorage';

export default function CheckerAccess() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'invalid' | 'expired' | 'ok'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!code) {
      setStatus('invalid');
      setErrorMessage('No checker code provided');
      return;
    }

    (async () => {
      try {
        const result = await validateCheckerLink(code);
        
        if (!result) {
          setStatus('invalid');
          setErrorMessage('Invalid or expired checker link');
          return;
        }

        // Store the checker session locally
        await SafeAsyncStorage.setItem('checker_token', code);
        await SafeAsyncStorage.setItem('checker_event_id', result.event_id);

        // Redirect directly to the event check-in screen
        setStatus('ok');
        
        // Navigate to the check-in index page
        // The check-in screen should detect the checker token
        router.replace('/');
      } catch (err) {
        console.error('Checker validation failed:', err);
        setStatus('invalid');
        setErrorMessage('Failed to validate checker link');
      }
    })();
  }, [code]);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Validating checker link...</Text>
      </View>
    );
  }

  if (status === 'invalid' || status === 'expired') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>⚠️ Invalid Link</Text>
        <Text style={styles.errorMessage}>
          {errorMessage || 'This checker link is invalid or has expired.'}
        </Text>
        <Text style={styles.helpText}>
          Please contact the event organizer for a new link.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Loading event...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
});


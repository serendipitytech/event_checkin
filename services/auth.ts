import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { getSupabaseClient } from './supabase';
import { REDIRECT_URL, DEEP_LINK_SCHEME, getDebugInfo } from '../config/env';

export const launchMagicLinkSignIn = async (): Promise<void> => {
  const supabase = getSupabaseClient();
  
  // Log debug information in development
  const debugInfo = getDebugInfo();
  if (debugInfo) {
    console.log('Auth Debug Info:', debugInfo);
  }
  
  // For now, we'll use a simple email prompt
  // In a production app, you might want a more sophisticated UI
  Alert.prompt(
    'Sign In',
    'Enter your email address to receive a magic link',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Send Link',
        onPress: async (email) => {
          if (!email || !email.trim()) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
          }

          try {
            const { error } = await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: {
                emailRedirectTo: REDIRECT_URL,
              },
            });

            if (error) {
              throw error;
            }

            Alert.alert(
              'Check Your Email',
              'We\'ve sent you a magic link. Check your email and tap the link to sign in.',
              [
                {
                  text: 'Open Email App',
                  onPress: () => {
                    // Try to open the default email app
                    Linking.openURL('mailto:');
                  },
                },
                {
                  text: 'OK',
                  style: 'default',
                },
              ]
            );
          } catch (error) {
            console.error('Magic link sign-in error:', error);
            Alert.alert(
              'Sign In Failed',
              error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
            );
          }
        },
      },
    ],
    'plain-text',
    '',
    'email-address'
  );
};

export const handleAuthCallback = async (url: string): Promise<void> => {
  const supabase = getSupabaseClient();
  
  try {
    console.log('Handling auth callback with URL:', url);
    
    const { data, error } = await supabase.auth.getSessionFromUrl(url);
    
    if (error) {
      throw error;
    }
    
    if (data.session) {
      Alert.alert('Success', 'You have been signed in successfully!');
    }
  } catch (error) {
    console.error('Auth callback error:', error);
    Alert.alert(
      'Sign In Failed',
      error instanceof Error ? error.message : 'Failed to complete sign in. Please try again.'
    );
  }
};

// Enhanced deep link handler that works with the dynamic scheme
export const handleDeepLink = async (url: string): Promise<void> => {
  console.log('Received deep link:', url);
  
  // Check if this is an auth callback
  if (url.includes('auth/callback') || url.includes(DEEP_LINK_SCHEME)) {
    await handleAuthCallback(url);
  }
};

// Initialize deep link handling
export const initializeDeepLinkHandling = async (): Promise<void> => {
  try {
    // Check if app was opened with a deep link
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      console.log('App opened with initial URL:', initialUrl);
      await handleDeepLink(initialUrl);
    }

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('Deep link received while app running:', event.url);
      handleDeepLink(event.url);
    });

    // Return cleanup function
    return () => {
      subscription?.remove();
    };
  } catch (error) {
    console.error('Failed to initialize deep link handling:', error);
  }
};

import { Alert } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import Constants from 'expo-constants';
import { getSupabaseClient } from './supabase';
import { verifyAuthUrl, getAuthRedirectUrl } from '../utils/verifyAuthUrl';

export const launchMagicLinkSignIn = async (): Promise<void> => {
  const supabase = getSupabaseClient();
  
  // CRITICAL: Force the correct redirect URL using Linking.createURL
  const redirectTo = ExpoLinking.createURL('/auth/callback');
  console.log('🔗 Forcing redirectTo:', redirectTo);
  
  // Verify the URL generation is working correctly
  const verifiedUrl = verifyAuthUrl();
  
  // Ensure we're not falling back to Supabase domain
  if (verifiedUrl.includes('supabase.co')) {
    console.error('❌ CRITICAL ERROR: Generated URL contains supabase.co domain!');
    console.error('This will cause Supabase to redirect to its own domain instead of your app!');
    console.error('Check your Supabase dashboard redirect URLs configuration.');
    Alert.alert(
      'Configuration Error',
      'The redirect URL is incorrectly configured. Please check the console for details.'
    );
    return;
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
                onPress: async (email?: string) => {
          if (!email || !email.trim()) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
          }

          try {
            console.log('=== SENDING MAGIC LINK ===');
            console.log('Email:', email.trim());
            console.log('🔗 Forcing redirectTo:', redirectTo);
            console.log('URL format check:');
            console.log('- Contains exp.direct:', redirectTo.includes('.exp.direct'));
            console.log('- Contains localhost:', redirectTo.includes('localhost'));
            console.log('- Contains supabase.co:', redirectTo.includes('supabase.co'));
            console.log('- Contains expo-checkin:', redirectTo.includes('expo-checkin'));
            
            // CRITICAL: Force the correct redirect URL - this guarantees Supabase sends the right link
            const { data, error } = await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: {
                emailRedirectTo: redirectTo, // ✅ force correct redirect
              },
            });

            if (error) {
              console.error('❌ Supabase OTP error:', error.message);
              throw error;
            }

            // Validate that Supabase accepted our redirect URL
            if (data && !redirectTo.includes('/auth/callback')) {
              console.warn('⚠️ WARNING: Supabase may not have accepted our redirect URL');
              console.warn('Expected URL format with /auth/callback, got:', redirectTo);
            }

            Alert.alert(
              'Check Your Email',
              'We\'ve sent you a magic link. Check your email and tap the link to sign in.',
              [
                {
                  text: 'Open Email App',
                  onPress: () => {
                    // Try to open the default email app
                    ExpoLinking.openURL('mailto:');
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
    
    // Use Supabase v2 exchangeCodeForSession method
    const { data, error } = await supabase.auth.exchangeCodeForSession(url);
    
    if (error) {
      console.error('❌ Auth exchange failed:', error.message);
      throw error;
    }
    
    if (data.session) {
      console.log('✅ Session established successfully');
      console.log('User ID:', data.user?.id);
      console.log('Email:', data.user?.email);
      Alert.alert('Success', 'You have been signed in successfully!');
    } else {
      console.error('❌ No session established after exchange');
      Alert.alert('Sign In Failed', 'No session was established. Please try again.');
    }
  } catch (error) {
    console.error('❌ Auth callback error:', error);
    Alert.alert(
      'Sign In Failed',
      error instanceof Error ? error.message : 'Failed to complete sign in. Please try again.'
    );
  }
};

// Enhanced deep link handler that works with the dynamic scheme
export const handleDeepLink = async (url: string): Promise<void> => {
  console.log('=== RECEIVED DEEP LINK ===');
  console.log('Full URL:', url);
  console.log('URL format check:');
  console.log('- Contains exp.direct:', url.includes('.exp.direct'));
  console.log('- Contains auth/callback:', url.includes('auth/callback'));
  console.log('- Contains --/auth/callback:', url.includes('--/auth/callback'));
  console.log('- Contains expo-checkin:', url.includes('expo-checkin'));
  console.log('- Contains supabase.co:', url.includes('supabase.co'));
  console.log('- Contains access_token:', url.includes('access_token'));
  console.log('- Contains code:', url.includes('code='));
  
  // Check if this is an auth callback - accept these specific patterns:
  // - */--/auth/callback (Expo Go format)
  // - /auth/callback (standard format)
  // - URLs with auth tokens or codes
  const isAuthCallback = 
    url.includes('/auth/callback') || 
    url.includes('--/auth/callback') ||
    url.includes('verify') ||
    url.includes('access_token') ||
    url.includes('code=') ||
    (url.includes('supabase.co') && url.includes('token'));
  
  if (isAuthCallback) {
    console.log('✅ Auth callback detected, processing with exchangeCodeForSession...');
    await handleAuthCallback(url);
  } else {
    console.log('❌ Not an auth callback URL');
    console.log('URL does not match expected auth callback patterns');
  }
};

// Initialize deep link handling
export const initializeDeepLinkHandling = async (): Promise<() => void> => {
  try {
    // Check if app was opened with a deep link
    const initialUrl = await ExpoLinking.getInitialURL();
    if (initialUrl) {
      console.log('App opened with initial URL:', initialUrl);
      await handleDeepLink(initialUrl);
    }

    // Listen for deep links while app is running
    const subscription = ExpoLinking.addEventListener('url', (event) => {
      console.log('Deep link received while app running:', event.url);
      handleDeepLink(event.url);
    });

    // Return cleanup function
    return () => {
      subscription?.remove();
    };
  } catch (error) {
    console.error('Failed to initialize deep link handling:', error);
    return () => {}; // Return empty cleanup function
  }
};

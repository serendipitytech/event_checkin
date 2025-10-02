import { Alert, Linking } from 'react-native';
import { getSupabaseClient } from './supabase';

export const launchMagicLinkSignIn = async (): Promise<void> => {
  const supabase = getSupabaseClient();
  
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
                emailRedirectTo: 'expo-checkin://auth/callback',
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

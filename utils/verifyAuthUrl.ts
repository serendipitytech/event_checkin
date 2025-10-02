import * as ExpoLinking from 'expo-linking';
import Constants from 'expo-constants';

/**
 * Verify that the auth URL generation is working correctly
 * This should be called when testing magic link authentication
 */
export const verifyAuthUrl = (): string => {
  const generatedUrl = ExpoLinking.createURL('/auth/callback');
  
  console.log('=== AUTH URL VERIFICATION ===');
  console.log('Generated URL:', generatedUrl);
  console.log('Environment:', __DEV__ ? 'Development' : 'Production');
  console.log('App Ownership:', Constants.appOwnership);
  console.log('Expo Go:', Constants.appOwnership === 'expo');
  
  // Check URL format
  if (generatedUrl.includes('.exp.direct')) {
    console.log('✅ TUNNEL URL DETECTED - This will work on physical devices');
  } else if (generatedUrl.includes('127.0.0.1')) {
    console.log('⚠️  LOCALHOST URL - This will only work on localhost/simulator');
  } else if (generatedUrl.includes('expo-checkin')) {
    console.log('✅ CUSTOM SCHEME URL - This is for production builds');
  } else {
    console.log('❓ UNKNOWN URL FORMAT - Unexpected result');
  }
  
  return generatedUrl;
};

/**
 * Get the current auth redirect URL
 * Use this in your auth service instead of hardcoded values
 */
export const getAuthRedirectUrl = (): string => {
  return ExpoLinking.createURL('/auth/callback');
};

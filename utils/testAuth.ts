/**
 * Lintnotes
 * - Purpose: Developer helpers to debug auth URL generation and Supabase environment configuration.
 * - Exports: testAuthUrlGeneration, debugSupabaseConfig
 * - Major deps: expo-linking, expo-constants
 * - Side effects: Console logging for diagnostics only.
 */
import * as ExpoLinking from 'expo-linking';
import Constants from 'expo-constants';

// Test function to debug auth URL generation
export const testAuthUrlGeneration = () => {
  console.log('=== AUTH URL GENERATION TEST ===');
  console.log('Environment:', __DEV__ ? 'Development' : 'Production');
  console.log('App Ownership:', Constants.appOwnership);
  console.log('Expo Go:', Constants.appOwnership === 'expo');
  
  const generatedUrl = ExpoLinking.createURL('/auth');
  console.log('Generated URL:', generatedUrl);
  
  // Test different scenarios
  console.log('\n--- URL Generation Tests ---');
  console.log('1. Auth callback:', ExpoLinking.createURL('/auth'));
  console.log('2. Root path:', ExpoLinking.createURL('/'));
  console.log('3. Deep link scheme from constants:', Constants.expoConfig?.scheme);
  
  // Check if we're in tunnel mode
  if (generatedUrl.includes('.exp.direct')) {
    console.log('✅ TUNNEL MODE DETECTED - This should work on physical devices');
  } else if (generatedUrl.includes('127.0.0.1')) {
    console.log('⚠️  LOCAL MODE - This will only work on localhost');
  } else if (generatedUrl.includes('expo-checkin')) {
    console.log('✅ PRODUCTION MODE - Custom scheme detected');
  } else {
    console.log('❓ UNKNOWN MODE - Unexpected URL format');
  }
  
  return generatedUrl;
};

// Function to help debug Supabase configuration
export const debugSupabaseConfig = () => {
  console.log('=== SUPABASE CONFIG DEBUG ===');
  console.log('Environment variables:');
  console.log('- EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET');
  console.log('- EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
  
  console.log('\nExpo config extra:');
  const extra = Constants?.expoConfig?.extra ?? {};
  console.log('- supabaseUrl:', extra.supabaseUrl ? 'SET' : 'NOT SET');
  console.log('- supabaseAnonKey:', extra.supabaseAnonKey ? 'SET' : 'NOT SET');
  
  console.log('\nApp config:');
  console.log('- Scheme:', Constants.expoConfig?.scheme);
  console.log('- Bundle ID:', Constants.expoConfig?.ios?.bundleIdentifier);
  console.log('- Package:', Constants.expoConfig?.android?.package);
};

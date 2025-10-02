import Constants from 'expo-constants';

// Environment detection
const isDev = __DEV__;
const isExpoGo = Constants.appOwnership === 'expo';

// Supabase configuration
const getSupabaseConfig = () => {
  // Try to get from environment variables first
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  // Fallback to expo config extra
  const expoExtra = Constants?.expoConfig?.extra ?? {};
  const configUrl = expoExtra.supabaseUrl;
  const configKey = expoExtra.supabaseAnonKey;
  
  const supabaseUrl = envUrl || configUrl || '';
  const supabaseAnonKey = envKey || configKey || '';
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase credentials are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables or configure them in app.config.js extra section.'
    );
  }
  
  return { supabaseUrl, supabaseAnonKey };
};

// Dynamic redirect URL configuration
const getRedirectUrl = () => {
  if (isDev) {
    // Development environment
    if (isExpoGo) {
      // Expo Go app
      return 'exp://127.0.0.1:8081';
    } else {
      // Development build
      return 'http://localhost:3000';
    }
  } else {
    // Production environment
    return 'expo-checkin://auth/callback';
  }
};

// Deep link scheme
const getDeepLinkScheme = () => {
  return 'expo-checkin';
};

// Auth configuration
const getAuthConfig = () => {
  const redirectUrl = getRedirectUrl();
  const deepLinkScheme = getDeepLinkScheme();
  
  return {
    redirectUrl,
    deepLinkScheme,
    // Additional auth URLs for different scenarios
    authUrls: {
      // Primary redirect URL
      primary: redirectUrl,
      // Fallback URLs that should be whitelisted in Supabase
      fallbacks: isDev 
        ? ['exp://127.0.0.1:8081', 'http://localhost:3000']
        : ['expo-checkin://auth/callback', 'https://checkin.yourdomain.com'],
    },
  };
};

// Export configuration
export const config = {
  ...getSupabaseConfig(),
  ...getAuthConfig(),
  isDev,
  isExpoGo,
};

// Individual exports for convenience
export const SUPABASE_URL = config.supabaseUrl;
export const SUPABASE_ANON_KEY = config.supabaseAnonKey;
export const REDIRECT_URL = config.redirectUrl;
export const DEEP_LINK_SCHEME = config.deepLinkScheme;
export const AUTH_URLS = config.authUrls;

// Validation function
export const validateConfig = () => {
  const errors: string[] = [];
  
  if (!SUPABASE_URL) {
    errors.push('SUPABASE_URL is required');
  }
  
  if (!SUPABASE_ANON_KEY) {
    errors.push('SUPABASE_ANON_KEY is required');
  }
  
  if (!REDIRECT_URL) {
    errors.push('REDIRECT_URL could not be determined');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }
  
  return true;
};

// Debug information (only in development)
export const getDebugInfo = () => {
  if (!isDev) return null;
  
  return {
    environment: isDev ? 'development' : 'production',
    appOwnership: Constants.appOwnership,
    isExpoGo,
    supabaseUrl: SUPABASE_URL,
    redirectUrl: REDIRECT_URL,
    deepLinkScheme: DEEP_LINK_SCHEME,
    authUrls: AUTH_URLS,
  };
};

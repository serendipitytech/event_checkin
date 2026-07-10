/**
 * Lintnotes
 * - Purpose: Supabase authentication helpers for magic link sign-in, callback processing, and deep link listeners.
 * - Exports: launchMagicLinkSignIn, handleAuthCallback, initializeDeepLinkHandling, addCodeLinkListener; internal parseFragment helper.
 * - Major deps: react-native Alert, expo-linking, expo-constants, services/supabase
 * - Side effects: Displays prompts/alerts, subscribes to Linking URL events, sets Supabase session when tokens present.
 */
import { Alert, Platform } from "react-native";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { getSupabaseClient } from "./supabase";
import { parseCodeFromUrl } from "./qrCodeGeneration";
import { logger } from '../utils/logger';

export type CodeLinkPayload = {
  code: string;
  eventId: string | null;
};

type CodeLinkListener = (payload: CodeLinkPayload) => void;
const codeLinkListeners = new Set<CodeLinkListener>();

export function addCodeLinkListener(listener: CodeLinkListener): () => void {
  codeLinkListeners.add(listener);
  return () => {
    codeLinkListeners.delete(listener);
  };
}

function emitCodeLink(payload: CodeLinkPayload): void {
  codeLinkListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (err) {
      logger.error("Code link listener error:", err);
    }
  });
}

/** Parse the fragment (after #) in URLs to extract auth tokens */
const parseFragment = (url: string): Record<string, string> => {
  try {
    const fragment = url.split("#")[1];
    if (!fragment) return {};
    const params = new URLSearchParams(fragment);
    const result: Record<string, string> = {};
    for (const [key, value] of params.entries()) result[key] = value;
    return result;
  } catch (err) {
    logger.error("Failed to parse URL fragment:", err);
    return {};
  }
};

/** Trigger Supabase magic link sign-in */
export const launchMagicLinkSignIn = async (): Promise<void> => {
  const supabase = getSupabaseClient();

  const redirectTo = process.env.EXPO_PUBLIC_REDIRECT_URL;
  if (!redirectTo) {
    throw new Error('EXPO_PUBLIC_REDIRECT_URL is not configured. Cannot send magic link.');
  }

  logger.debug("Using redirectTo:", redirectTo);
  logger.debug("Execution Environment:", Constants.executionEnvironment);
  // Web: use window.prompt; Native: use Alert.prompt
  if (Platform.OS === 'web') {
    // Web prompt fallback
    const input = (typeof window !== 'undefined' && window.prompt
      ? window.prompt('Enter your email to sign in:')
      : '') || '';

    const email = input.trim();
    if (!email) return;

    try {
      logger.info('Sending magic link (web)');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Check your email for a magic link.');
      }
    } catch (err) {
      logger.error('Magic link error (web):', err);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(err instanceof Error ? err.message : 'Unexpected error');
      }
    }
    return;
  }

  // Native (iOS/Android)
  Alert.prompt(
    'Sign In',
    'Enter your email to receive a magic link',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send Link',
        onPress: async (email?: string) => {
          if (!email?.trim()) {
            Alert.alert('Error', 'Please enter a valid email address.');
            return;
          }

          try {
            logger.info('Sending magic link (native)');
            const { error } = await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: { emailRedirectTo: redirectTo },
            });

            if (error) throw error;

            Alert.alert('Check Your Email', 'Tap the link in your email to sign in.');
          } catch (err) {
            logger.error('Magic link error (native):', err);
            Alert.alert('Sign-in Failed', err instanceof Error ? err.message : 'Unexpected error');
          }
        },
      },
    ],
    'plain-text',
    '',
    'email-address'
  );
};

/** Check if URL is a code redemption link and emit event if so */
const handleCodeRedemptionUrl = (url: string): boolean => {
  const { code, eventId } = parseCodeFromUrl(url);

  if (code) {
    logger.info("Code redemption link detected");
    emitCodeLink({ code, eventId });
    return true;
  }

  return false;
};

/** Handle Supabase redirect callback */
export const handleAuthCallback = async (url: string): Promise<void> => {
  const supabase = getSupabaseClient();
  logger.debug("Handling redirect:", url);

  const fragment = parseFragment(url);
  const { access_token, refresh_token } = fragment;

  // Early return for normal app launches without auth tokens
  if (!access_token && !refresh_token) {
    logger.debug("No auth fragment detected — likely a normal app launch, skipping callback.");
    return;
  }

  if (access_token && refresh_token) {
    logger.info("Tokens detected, setting session...");
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) throw error;

      if (data?.session) {
        logger.info("User signed in successfully");
        logger.info("Supabase session restored from storage or token exchange.");
        Alert.alert("Welcome!", "You're now signed in.");
      } else {
        logger.warn("No session returned from Supabase after setSession.");
      }
    } catch (err) {
      // Gracefully handle common errors like unknown user/token mismatch
      logger.warn("Auth callback processing failed:", err);
      Alert.alert("Sign-in Failed", "This magic link is invalid or expired.");
    }
  } else {
    // Malformed token case: we had a fragment but were missing one of the tokens
    logger.warn("Incomplete auth tokens found in callback URL.");
    Alert.alert("Sign-in Failed", "Invalid or expired magic link.");
  }
};

/** Listen for and handle deep links */
export const initializeDeepLinkHandling = async (): Promise<() => void> => {
  try {
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      logger.debug("App opened via URL:", initialUrl);

      if (initialUrl.includes('#access_token')) {
        await handleAuthCallback(initialUrl);
      } else if (initialUrl.includes('code=') || initialUrl.includes('/redeem')) {
        handleCodeRedemptionUrl(initialUrl);
      } else {
        logger.debug("No auth fragment or code in initial URL; skipping callback handler.");
      }
    }

    const subscription = Linking.addEventListener("url", (event) => {
      logger.debug("Received deep link:", event.url);

      if (event.url?.includes('#access_token')) {
        handleAuthCallback(event.url);
      } else if (event.url?.includes('code=') || event.url?.includes('/redeem')) {
        handleCodeRedemptionUrl(event.url);
      } else {
        logger.debug("No auth fragment or code in deep link; skipping callback handler.");
      }
    });

    return () => subscription.remove();
  } catch (err) {
    logger.error("Failed to initialize deep link listener:", err);
    return () => {};
  }
};

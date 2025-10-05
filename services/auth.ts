/**
 * Lintnotes
 * - Purpose: Supabase authentication helpers for magic link sign-in, callback processing, and deep link listeners.
 * - Exports: launchMagicLinkSignIn, handleAuthCallback, initializeDeepLinkHandling; internal parseFragment helper.
 * - Major deps: react-native Alert, expo-linking, expo-constants, services/supabase
 * - Side effects: Displays prompts/alerts, subscribes to Linking URL events, sets Supabase session when tokens present.
 */
import { Alert } from "react-native";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { getSupabaseClient } from "./supabase";

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
    console.error("Failed to parse URL fragment:", err);
    return {};
  }
};

/** Trigger Supabase magic link sign-in */
export const launchMagicLinkSignIn = async (): Promise<void> => {
  const supabase = getSupabaseClient();

  const redirectTo = process.env.EXPO_PUBLIC_REDIRECT_URL;
  if (!redirectTo) {
    Alert.alert("Missing Redirect URL", "No redirect URL configured.");
    return;
  }

  console.log("🔗 Using redirectTo:", redirectTo);
  console.log("🔧 Execution Environment:", Constants.executionEnvironment);

  Alert.prompt(
    "Sign In",
    "Enter your email to receive a magic link",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send Link",
        onPress: async (email?: string) => {
          if (!email?.trim()) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
          }

          try {
            console.log("📨 Sending magic link to:", email.trim());
            const { data, error } = await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: { emailRedirectTo: redirectTo },
            });

            if (error) throw error;

            Alert.alert(
              "Check Your Email",
              "Tap the link in your email to sign in."
            );
          } catch (err) {
            console.error("Magic link error:", err);
            Alert.alert(
              "Sign-in Failed",
              err instanceof Error ? err.message : "Unexpected error"
            );
          }
        },
      },
    ],
    "plain-text",
    "",
    "email-address"
  );
};

/** Handle Supabase redirect callback */
export const handleAuthCallback = async (url: string): Promise<void> => {
  const supabase = getSupabaseClient();
  console.log("Handling redirect:", url);

  const fragment = parseFragment(url);
  const { access_token, refresh_token } = fragment;

  if (access_token && refresh_token) {
    console.log("✅ Tokens detected, setting session...");
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;

    if (data?.session) {
      console.log("✅ Signed in user:", data.user?.email);
      Alert.alert("Welcome!", "You're now signed in.");
    } else {
      throw new Error("No session returned from Supabase.");
    }
  } else {
    console.warn("❌ No tokens found in callback URL.");
    Alert.alert("Sign-in Failed", "Invalid or expired magic link.");
  }
};

/** Listen for and handle deep links */
export const initializeDeepLinkHandling = async (): Promise<() => void> => {
  try {
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      console.log("App opened via URL:", initialUrl);
      await handleAuthCallback(initialUrl);
    }

    const subscription = Linking.addEventListener("url", (event) => {
      console.log("Received deep link:", event.url);
      handleAuthCallback(event.url);
    });

    return () => subscription.remove();
  } catch (err) {
    console.error("Failed to initialize deep link listener:", err);
    return () => {};
  }
};

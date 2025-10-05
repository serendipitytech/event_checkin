/**
 * Lintnotes
 * - Purpose: Fallback auth route/screen that navigates users after magic-link handling. Shows a short loading state then routes home.
 * - Exports: default AuthHandler (React component)
 * - Major deps: expo-router (useRouter), react-native ActivityIndicator/Text
 * - Side effects: Performs navigation via router.replace after a brief timeout; no direct auth mutation here.
 */
import { useEffect } from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { handleAuthCallback } from "../services/auth";

export default function AuthHandler() {
  const router = useRouter();

  useEffect(() => {
    // Handle the auth callback from deep link
    const handleAuth = async () => {
      try {
        // The deep link handler should have already processed the authentication
        // This component serves as a fallback and navigation handler
        console.log('Auth route handler - processing authentication...');
        
        // Small delay to ensure deep link processing is complete
        setTimeout(() => {
          router.replace("/"); // Redirect to home screen after successful auth
        }, 1000);
      } catch (error) {
        console.error('Auth route handler error:', error);
        // Redirect to home even on error to prevent getting stuck
        router.replace("/");
      }
    };

    handleAuth();
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 16, fontSize: 16, color: "#666" }}>
        Signing you in...
      </Text>
    </View>
  );
}

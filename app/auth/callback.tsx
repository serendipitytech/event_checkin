/**
 * Lintnotes
 * - Purpose: Route target for Supabase auth callback deep links.
 * - Exports: default AuthCallback (React component)
 * - Major deps: expo-router (useRouter), react-native, services/supabase
 * - Side effects: Polls for session, then navigates home.
 */
import { useEffect, useState } from "react";
import { Text, View, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { getSupabaseClient } from "../../services/supabase";

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 500;

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const pollForSession = async () => {
      const supabase = getSupabaseClient();

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        if (cancelled) return;

        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            router.replace("/");
            return;
          }
        } catch (err) {
          console.error("Auth callback poll error:", err);
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!cancelled) {
        setError(true);
      }
    };

    pollForSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
          Sign-in failed
        </Text>
        <Text style={{ fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 20 }}>
          The magic link may have expired. Please try again.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: "#111827", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
          onPress={() => router.replace("/")}
        >
          <Text style={{ color: "#ffffff", fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 16, fontSize: 16, color: "#666" }}>
        Signing you in...
      </Text>
    </View>
  );
}

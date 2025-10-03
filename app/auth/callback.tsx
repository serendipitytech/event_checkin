import { useEffect } from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // After successful auth, redirect user to home (or dashboard)
    // The deep link handler has already processed the authentication
    const timer = setTimeout(() => {
      router.replace("/"); // Redirect to home screen
    }, 500); // Small delay to show loading state
    
    return () => clearTimeout(timer);
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

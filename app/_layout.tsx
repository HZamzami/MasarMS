import "../global.css";

import { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Slot, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const routeRef = useRef<"/" | "/login" | "/onboarding/profile">("/login");
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // Check whether the user has completed onboarding (phenotype set).
        const { data: profile } = await supabase
          .from("profiles")
          .select("ms_phenotype")
          .eq("id", session.user.id)
          .single();

        routeRef.current =
          profile?.ms_phenotype ? "/" : "/onboarding/profile";
      } else {
        routeRef.current = "/login";
      }

      if (mounted) setReady(true);
    }

    bootstrap();

    // Keep session current so sign-out is reflected immediately.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session: Session | null) => {
      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    router.replace(routeRef.current);
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Slot />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

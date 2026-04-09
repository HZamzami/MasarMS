import '../global.css';

import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Slot, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

SplashScreen.preventAutoHideAsync();

/**
 * Determines the correct post-auth route based on whether the user has
 * completed onboarding (ms_phenotype set).
 */
async function resolveRoute(session: Session): Promise<'/' | '/onboarding/profile'> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('ms_phenotype')
    .eq('id', session.user.id)
    .single();

  return profile?.ms_phenotype ? '/' : '/onboarding/profile';
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const routeRef = useRef<'/' | '/onboarding/profile' | '/(auth)/welcome'>('/(auth)/welcome');
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        routeRef.current = await resolveRoute(session);
      } else {
        routeRef.current = '/(auth)/welcome';
      }

      if (mounted) setReady(true);
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session: Session | null) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/(auth)/welcome');
        return;
      }

      if (event === 'SIGNED_IN') {
        // Always re-check phenotype so new users land on onboarding,
        // returning users land on the dashboard.
        const route = await resolveRoute(session);
        router.replace(route);
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

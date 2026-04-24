import '../global.css';

import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Slot, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';
import { LocalizationProvider, loadStoredLanguage } from '../lib/i18n';
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
  const [initialLanguage, setInitialLanguage] = useState<'en' | 'ar'>('ar');
  const routeRef = useRef<string>('/(auth)/welcome');
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const [
        {
          data: { session },
        },
        language,
      ] = await Promise.all([
        supabase.auth.getSession(),
        loadStoredLanguage(),
      ]);

      if (session) {
        const route = await resolveRoute(session);
        routeRef.current = route;
      } else {
        routeRef.current = '/(auth)/welcome';
      }

      if (mounted) {
        setInitialLanguage(language);
        setReady(true);
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session: Session | null) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/(auth)/welcome' as any);
        return;
      }

      if (event === 'SIGNED_IN') {
        const route = await resolveRoute(session);
        router.replace(route as any);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    router.replace(routeRef.current as any);
  }, [ready, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LocalizationProvider initialLanguage={initialLanguage}>
        <SafeAreaProvider>
          <WebFrame>
            <LocalizedSlot />
          </WebFrame>
        </SafeAreaProvider>
      </LocalizationProvider>
    </GestureHandlerRootView>
  );
}

function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#dbe4e9' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

function LocalizedSlot() {
  return (
    <View style={{ flex: 1 }}>
      <Slot />
    </View>
  );
}

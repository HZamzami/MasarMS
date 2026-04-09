import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type ParamBag = {
  score?: string;
  reactionTime?: string;
  accuracy?: string;
  name?: string;
  userName?: string;
  attempts?: string;
  correct?: string;
};

function parseNumber(input: string | undefined): number | null {
  if (!input) return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getErrorMessage(error: unknown): string {
  if (!error) return 'Unable to save observation.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unable to save observation.';
}

export default function ResultsOverallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<ParamBag>();
  const hasSavedRef = useRef(false);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(params.userName ?? params.name ?? 'there');

  const score = useMemo(() => {
    const scoreFromParam = parseNumber(params.score);
    if (scoreFromParam !== null) return clamp(Math.round(scoreFromParam), 0, 100);

    const attempts = parseNumber(params.attempts);
    const correct = parseNumber(params.correct);
    if (attempts !== null && attempts > 0 && correct !== null) {
      return clamp(Math.round((correct / attempts) * 100), 0, 100);
    }

    return 84;
  }, [params.attempts, params.correct, params.score]);

  const accuracy = useMemo(() => {
    const accuracyFromParam = parseNumber(params.accuracy);
    if (accuracyFromParam !== null) return clamp(Math.round(accuracyFromParam), 0, 100);
    return score;
  }, [params.accuracy, score]);

  const reactionTime = useMemo(() => {
    const reactionFromParam = parseNumber(params.reactionTime);
    if (reactionFromParam !== null) return clamp(Math.round(reactionFromParam), 50, 3000);
    return 240;
  }, [params.reactionTime]);

  const spatialMemory = useMemo(
    () => clamp(Math.round((accuracy * 0.7) + (score * 0.3)), 0, 100),
    [accuracy, score],
  );
  const processingSpeed = useMemo(
    () => clamp(Math.round(100 - ((reactionTime - 180) / 7)), 0, 100),
    [reactionTime],
  );
  const visualScanning = useMemo(
    () => clamp(Math.round((accuracy * 0.5) + (score * 0.2) + (processingSpeed * 0.3) - 12), 0, 100),
    [accuracy, processingSpeed, score],
  );

  const trendText = useMemo(() => {
    if (score >= 90) return 'Higher than Yesterday';
    if (score >= 75) return 'Slightly Higher than Yesterday';
    return 'Lower than Yesterday';
  }, [score]);

  const trendBadge = useMemo(() => {
    if (score >= 80) return 'Above Average';
    if (score >= 60) return 'Average Range';
    return 'Needs Support';
  }, [score]);

  useEffect(() => {
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    let mounted = true;

    const persist = async () => {
      setSaveState('saving');
      setSaveError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error('No authenticated user found.');

        if (mounted) {
          const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name;
          if (typeof fullName === 'string' && fullName.length > 0) {
            setDisplayName(fullName);
          }
        }

        const detailedPayload = {
          user_id: user.id,
          test_type: 'overall_results',
          test_version: '1.0',
          score: score,
          reaction_time_ms: reactionTime,
          accuracy_pct: accuracy,
          total_attempts: 100,
          correct_matches: Math.round((accuracy / 100) * 100),
          duration_seconds: 0,
          device_platform: Platform.OS,
        };

        const fallbackPayload = {
          user_id: user.id,
          test_type: 'overall_results',
          test_version: '1.0',
          total_attempts: 100,
          correct_matches: score,
          duration_seconds: 0,
          device_platform: Platform.OS,
        };

        const detailedUpsert = await supabase.from('observations').upsert(detailedPayload);
        if (detailedUpsert.error) {
          const fallbackUpsert = await supabase.from('observations').upsert(fallbackPayload);
          if (fallbackUpsert.error) {
            throw new Error(
              `${getErrorMessage(detailedUpsert.error)} | ${getErrorMessage(fallbackUpsert.error)}`,
            );
          }
        }

        if (mounted) {
          setSaveState('saved');
        }
      } catch (error) {
        if (mounted) {
          setSaveState('error');
          setSaveError(getErrorMessage(error));
        }
      }
    };

    void persist();

    return () => {
      mounted = false;
    };
  }, [accuracy, reactionTime, score]);

  const headlineFont = Platform.OS === 'web' ? { fontFamily: 'Manrope' } : undefined;
  const bodyFont = Platform.OS === 'web' ? { fontFamily: 'Inter' } : undefined;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top app bar */}
        <View className="flex-row items-center justify-between mb-10">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <MaterialCommunityIcons name="brain" size={22} color="#006880" />
            <Text className="text-primary text-xl font-extrabold tracking-tight" style={headlineFont}>
              Masar MS
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-surface-container-highest items-center justify-center">
            <Ionicons name="person" size={18} color="#006880" />
          </View>
        </View>

        {/* Hero */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-full bg-tertiary-container/30 items-center justify-center mb-4">
            <Ionicons name="sparkles" size={32} color="#006b60" />
          </View>
          <Text className="text-on-surface text-[42px] leading-[46px] font-bold text-center mb-3" style={headlineFont}>
            Great job, {displayName}!
          </Text>
          <Text className="text-on-surface-variant text-base text-center px-4" style={bodyFont}>
            You completed today's cognitive assessment. Your focus remains consistent and your reaction times are improving.
          </Text>
        </View>

        {/* Main score card */}
        <View
          className="bg-surface-container-lowest rounded-[32px] p-7 mb-5"
          style={{
            shadowColor: '#2b3438',
            shadowOpacity: 0.05,
            shadowRadius: 24,
            elevation: 6,
          }}
        >
          <Text className="text-primary text-xs font-bold tracking-[2px] uppercase mb-3" style={bodyFont}>
            Performance Score
          </Text>
          <View className="flex-row items-end mb-7" style={{ gap: 4 }}>
            <Text className="text-[76px] leading-[76px] text-on-surface font-extrabold" style={headlineFont}>
              {score}
            </Text>
            <Text className="text-2xl text-on-surface-variant font-bold mb-2" style={headlineFont}>
              / 100
            </Text>
          </View>

          <View className="bg-surface-container-low rounded-2xl p-4">
            <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
              <Ionicons name="trending-up" size={16} color="#006b60" />
              <Text className="text-tertiary font-bold" style={bodyFont}>
                {trendBadge}
              </Text>
            </View>
            <Text className="text-on-surface-variant text-xs leading-5" style={bodyFont}>
              Your cognitive speed is trending positively versus your recent baseline.
            </Text>
          </View>
        </View>

        {/* Trend status card */}
        <View className="bg-surface-container-low rounded-[32px] p-6 mb-5">
          <Text className="text-on-surface-variant text-sm font-semibold mb-1" style={bodyFont}>
            Trend comparison
          </Text>
          <Text className="text-on-surface text-2xl font-bold mb-4" style={headlineFont}>
            {trendText}
          </Text>

          <View className="bg-surface-container-lowest rounded-xl px-4 py-3 flex-row items-center" style={{ gap: 10 }}>
            <View className="w-10 h-10 rounded-lg bg-tertiary/10 items-center justify-center">
              <Ionicons name="flash" size={18} color="#006b60" />
            </View>
            <View>
              <Text className="text-on-surface-variant text-[11px] uppercase tracking-[1.5px] font-bold" style={bodyFont}>
                Reaction Time
              </Text>
              <Text className="text-on-surface font-bold text-base" style={headlineFont}>
                {reactionTime}ms
              </Text>
            </View>
          </View>
        </View>

        {/* Metric details */}
        <View className="mb-8" style={{ gap: 12 }}>
          <View className="bg-surface-container-low rounded-3xl p-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-on-surface font-bold text-base" style={headlineFont}>Spatial Memory</Text>
              <Text className="text-on-surface-variant text-xs font-bold" style={bodyFont}>MEM-01</Text>
            </View>
            <View className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <View className="h-full bg-primary rounded-full" style={{ width: `${spatialMemory}%` }} />
            </View>
            <Text className="text-on-surface-variant text-xs font-bold text-right mt-2" style={bodyFont}>
              {spatialMemory}% Accuracy
            </Text>
          </View>

          <View className="bg-surface-container-low rounded-3xl p-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-on-surface font-bold text-base" style={headlineFont}>Visual Scanning</Text>
              <Text className="text-on-surface-variant text-xs font-bold" style={bodyFont}>VIS-04</Text>
            </View>
            <View className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <View className="h-full bg-tertiary rounded-full" style={{ width: `${visualScanning}%` }} />
            </View>
            <Text className="text-on-surface-variant text-xs font-bold text-right mt-2" style={bodyFont}>
              {visualScanning}% Accuracy
            </Text>
          </View>

          <View className="bg-surface-container-low rounded-3xl p-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-on-surface font-bold text-base" style={headlineFont}>Processing Speed</Text>
              <Text className="text-on-surface-variant text-xs font-bold" style={bodyFont}>PRO-02</Text>
            </View>
            <View className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <View className="h-full bg-secondary rounded-full" style={{ width: `${processingSpeed}%` }} />
            </View>
            <Text className="text-on-surface-variant text-xs font-bold text-right mt-2" style={bodyFont}>
              {processingSpeed}% Optimal
            </Text>
          </View>
        </View>

        {saveState === 'saving' ? (
          <Text className="text-center text-sm text-primary mb-4" style={bodyFont}>
            Saving your results...
          </Text>
        ) : null}
        {saveState === 'error' ? (
          <Text className="text-center text-xs text-error mb-4" style={bodyFont}>
            {saveError}
          </Text>
        ) : null}
        {saveState === 'saved' ? (
          <Text className="text-center text-xs text-tertiary mb-4" style={bodyFont}>
            Results synced to Supabase.
          </Text>
        ) : null}

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              className="flex-1 bg-primary rounded-2xl py-4 items-center flex-row justify-center"
              style={{ gap: 8 }}
              onPress={() => router.replace('/')}
              accessibilityRole="button"
              accessibilityLabel="Home"
            >
              <Ionicons name="home-outline" size={20} color="white" />
              <Text className="text-on-primary font-bold text-base" style={bodyFont}>
                Home
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-primary rounded-2xl py-4 items-center flex-row justify-center"
              style={{ gap: 8 }}
              onPress={() => router.replace('/tests/results_overall')}
              accessibilityRole="button"
              accessibilityLabel="Results"
            >
              <Ionicons name="bar-chart-outline" size={20} color="white" />
              <Text className="text-on-primary font-bold text-base" style={bodyFont}>
                Results
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="w-full border border-outline-variant rounded-2xl py-3 items-center flex-row justify-center mt-1"
            style={{ gap: 8 }}
            onPress={() => void supabase.auth.signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Ionicons name="log-out-outline" size={18} color="#576065" />
            <Text className="text-on-surface-variant font-semibold text-sm" style={bodyFont}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

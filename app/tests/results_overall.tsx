import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getLocalizedErrorMessage, useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import { supabase } from '../../lib/supabase';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type ParamBag = {
  score?: string;
  reactionTime?: string;
  accuracy?: string;
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

function getErrorMessage(
  error: unknown,
  messages: ReturnType<typeof useLocalization>['messages'],
): string {
  return getLocalizedErrorMessage(error, messages, messages.common.saveFailed);
}

export default function ResultsOverallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<ParamBag>();
  const hasSavedRef = useRef(false);
  const { formatMessage, formatNumber, messages, row, textAlign } = useLocalization();

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

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
    if (score >= 90) return messages.resultsOverall.trendHigher;
    if (score >= 75) return messages.resultsOverall.trendSlightlyHigher;
    return messages.resultsOverall.trendLower;
  }, [messages.resultsOverall.trendHigher, messages.resultsOverall.trendLower, messages.resultsOverall.trendSlightlyHigher, score]);

  const trendBadge = useMemo(() => {
    if (score >= 80) return messages.resultsOverall.trendBadgeHigh;
    if (score >= 60) return messages.resultsOverall.trendBadgeAverage;
    return messages.resultsOverall.trendBadgeLow;
  }, [messages.resultsOverall.trendBadgeAverage, messages.resultsOverall.trendBadgeHigh, messages.resultsOverall.trendBadgeLow, score]);

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

        const detailedPayload = {
          user_id: user.id,
          test_type: 'overall_results',
          test_version: '1.0',
          score,
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
            throw new Error(`${getErrorMessage(detailedUpsert.error, messages)} | ${getErrorMessage(fallbackUpsert.error, messages)}`);
          }
        }

        if (mounted) setSaveState('saved');
      } catch (error) {
        if (mounted) {
          setSaveState('error');
          setSaveError(getErrorMessage(error, messages));
        }
      }
    };

    void persist();

    return () => {
      mounted = false;
    };
  }, [accuracy, messages, reactionTime, score]);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center justify-between mb-10" style={row}>
          <View className="items-center" style={[row, { gap: 10 }]}>
            <MaterialCommunityIcons name="brain" size={22} color="#006880" />
            <Text className="text-primary text-xl font-extrabold tracking-tight">
              {messages.common.appName}
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-surface-container-highest items-center justify-center">
            <Ionicons name="person" size={18} color="#006880" />
          </View>
        </View>

        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-full bg-tertiary-container/30 items-center justify-center mb-4">
            <Ionicons name="sparkles" size={32} color="#006b60" />
          </View>
          <Text className="text-on-surface text-2xl font-bold text-center mb-3" style={textAlign}>
            {messages.resultsOverall.heroTitle}
          </Text>
          <Text className="text-on-surface-variant text-base text-center px-4" style={textAlign}>
            {messages.resultsOverall.heroBody}
          </Text>
        </View>

        <View
          className="bg-surface-container-lowest rounded-[32px] p-7 mb-5"
          style={{ shadowColor: '#2b3438', shadowOpacity: 0.05, shadowRadius: 24, elevation: 6 }}
        >
          <Text className="text-primary text-xs font-bold tracking-[2px] uppercase mb-3">
            {messages.resultsOverall.performanceScore}
          </Text>
          <View className="items-end mb-7" style={[row, { gap: 4 }]}>
            <Text style={{ fontSize: 52, lineHeight: 60, fontWeight: '800', color: '#2b3438' }}>
              {formatNumber(score)}
            </Text>
            <Text className="text-xl text-on-surface-variant font-bold mb-2">
              / 100
            </Text>
          </View>

          <View className="bg-surface-container-low rounded-2xl p-4">
            <View className="items-center mb-2" style={[row, { gap: 6 }]}>
              <Ionicons name="trending-up" size={16} color="#006b60" />
              <Text className="text-tertiary font-bold">{trendBadge}</Text>
            </View>
            <Text className="text-on-surface-variant text-xs leading-5" style={textAlign}>
              {messages.resultsOverall.trendPositiveBody}
            </Text>
          </View>
        </View>

        <View className="bg-surface-container-low rounded-[32px] p-6 mb-5">
          <Text className="text-on-surface-variant text-sm font-semibold mb-1" style={textAlign}>
            {messages.resultsOverall.trendComparison}
          </Text>
          <Text className="text-on-surface text-xl font-bold mb-4" style={textAlign}>
            {trendText}
          </Text>

          <View className="bg-surface-container-lowest rounded-xl px-4 py-3 items-center" style={[row, { gap: 10 }]}>
            <View className="w-10 h-10 rounded-lg bg-tertiary/10 items-center justify-center">
              <Ionicons name="flash" size={18} color="#006b60" />
            </View>
            <View>
              <Text className="text-on-surface-variant text-[11px] uppercase tracking-[1.5px] font-bold" style={textAlign}>
                {messages.resultsOverall.reactionTime}
              </Text>
              <Text className="text-on-surface font-bold text-base" style={textAlign}>
                {formatNumber(reactionTime)}ms
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-8" style={{ gap: 12 }}>
          {[
            {
              label: messages.resultsOverall.spatialMemory,
              code: 'MEM-01',
              value: spatialMemory,
              color: '#006880',
              suffix: formatMessage(messages.resultsOverall.accuracySuffix, { value: formatNumber(spatialMemory) }),
            },
            {
              label: messages.resultsOverall.visualScanning,
              code: 'VIS-04',
              value: visualScanning,
              color: '#006b60',
              suffix: formatMessage(messages.resultsOverall.accuracySuffix, { value: formatNumber(visualScanning) }),
            },
            {
              label: messages.resultsOverall.processingSpeed,
              code: 'PRO-02',
              value: processingSpeed,
              color: '#005b71',
              suffix: formatMessage(messages.resultsOverall.optimalSuffix, { value: formatNumber(processingSpeed) }),
            },
          ].map((metric) => (
            <View key={metric.code} className="bg-surface-container-low rounded-3xl p-5">
              <View className="items-center justify-between mb-3" style={row}>
                <Text className="text-on-surface font-bold text-base" style={textAlign}>{metric.label}</Text>
                <Text className="text-on-surface-variant text-xs font-bold">{metric.code}</Text>
              </View>
              <View className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <View className="h-full rounded-full" style={{ width: `${metric.value}%`, backgroundColor: metric.color }} />
              </View>
              <Text className="text-on-surface-variant text-xs font-bold mt-2" style={textAlign}>
                {metric.suffix}
              </Text>
            </View>
          ))}
        </View>

        {saveState === 'saving' ? (
          <Text className="text-center text-sm text-primary mb-4" style={textAlign}>
            {messages.resultsOverall.saving}
          </Text>
        ) : null}
        {saveState === 'error' ? (
          <Text className="text-center text-xs text-error mb-4" style={textAlign}>
            {saveError}
          </Text>
        ) : null}
        {saveState === 'saved' ? (
          <Text className="text-center text-xs text-tertiary mb-4" style={textAlign}>
            {messages.resultsOverall.synced}
          </Text>
        ) : null}

        <View style={{ gap: 10 }}>
          <View style={[row, { gap: 10 }]}>
            <TouchableOpacity
              className="flex-1 bg-primary rounded-2xl py-4 items-center justify-center"
              style={[row, { gap: 8 }]}
              onPress={() => router.replace('/')}
              accessibilityRole="button"
              accessibilityLabel={messages.resultsOverall.homeA11y}
            >
              <Ionicons name="home-outline" size={20} color="white" />
              <Text className="text-on-primary font-bold text-base">
                {messages.common.home}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-primary rounded-2xl py-4 items-center justify-center"
              style={[row, { gap: 8 }]}
              onPress={() => router.replace('/tests/results_overall')}
              accessibilityRole="button"
              accessibilityLabel={messages.resultsOverall.resultsA11y}
            >
              <Ionicons name="bar-chart-outline" size={20} color="white" />
              <Text className="text-on-primary font-bold text-base">
                {messages.common.results}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="w-full border border-outline-variant rounded-2xl py-3 items-center justify-center mt-1"
            style={[row, { gap: 8 }]}
            onPress={() => void supabase.auth.signOut()}
            accessibilityRole="button"
            accessibilityLabel={messages.resultsOverall.signOutA11y}
          >
            <Ionicons name="log-out-outline" size={18} color="#576065" />
            <Text className="text-on-surface-variant font-semibold text-sm">
              {messages.common.signOut}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

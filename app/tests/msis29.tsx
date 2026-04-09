import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { saveTestResult } from '../../lib/saveTestResult';
import type { MSIS29Data } from '../../lib/types';

// ─── MSIS-29 v2 Questions ─────────────────────────────────────────────────────
// Validated Multiple Sclerosis Impact Scale (Hobart et al., 2001)
// Preamble: "In the past two weeks, how much has your MS limited you in..."

const PHYSICAL_ITEMS = [
  'The strength of your grip',
  'Your balance',
  'Doing physically demanding tasks',
  'Carrying things such as shopping bags',
  'Moving about indoors',
  'Clumsy movements',
  'Moving about as quickly as you would like',
  'Going up or down stairs',
  'Remaining in a sitting position for as long as needed',
  'Staying standing for as long as needed',
  'Reaching for things',
  'Turning over in bed',
  'Tasks using your hands or fingers',
  'Unsteadiness on your feet',
  'Spasms or cramps in your limbs',
  'Muscle weakness',
  'Coordination problems',
  'Shaky or trembling movements',
  'Pain or burning sensations',
  'Fatigue affecting your movement and physical activities',
] as const;

const PSYCHOLOGICAL_ITEMS = [
  'Having to rush to the toilet',
  'Worrying that you might fall or stumble',
  'Needing to plan trips around access to toilets',
  'Having to simplify or reduce your activities',
  'Feeling that you have to work harder to do things',
  'Problems concentrating on tasks',
  'Being worried that MS will get worse',
  'Feeling worried, anxious, or nervous',
  'Feeling depressed or low in mood',
] as const;

const RESPONSE_LABELS = [
  'Not at all',
  'A little',
  'Moderately',
  'Quite a bit',
  'Extremely',
] as const;

const TOTAL_ITEMS = PHYSICAL_ITEMS.length + PSYCHOLOGICAL_ITEMS.length; // 29

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeScores(responses: number[]): {
  physical: number;
  psychological: number;
  total: number;
} {
  const physSum = responses.slice(0, 20).reduce((a, b) => a + b, 0);
  const psySum  = responses.slice(20, 29).reduce((a, b) => a + b, 0);

  // Normalise to 0–100 (higher = more impact)
  const physical      = ((physSum - 20) / 80)  * 100;
  const psychological = ((psySum  -  9) / 36)  * 100;
  const total         = (physical + psychological) / 2;

  return {
    physical:      Math.round(physical * 10) / 10,
    psychological: Math.round(psychological * 10) / 10,
    total:         Math.round(total * 10) / 10,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function impactColor(score: number): string {
  if (score <= 25)  return '#006b60'; // Low impact
  if (score <= 50)  return '#005b71'; // Moderate
  if (score <= 75)  return '#b97c00'; // High
  return '#a83836';                   // Very high
}

function impactLabel(score: number): string {
  if (score <= 25)  return 'Low impact';
  if (score <= 50)  return 'Moderate impact';
  if (score <= 75)  return 'High impact';
  return 'Very high impact';
}

// ─── ResponseRow ──────────────────────────────────────────────────────────────

function ResponseRow({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View
      className="bg-surface-container rounded-2xl p-4 mb-3"
      style={value !== null ? { borderWidth: 1, borderColor: 'rgba(0,104,128,0.2)' } : undefined}
    >
      <Text className="text-sm font-semibold text-on-surface mb-3 leading-5">
        <Text className="text-primary font-bold">{index}. </Text>
        {question}
      </Text>
      <View className="flex-row" style={{ gap: 6 }}>
        {RESPONSE_LABELS.map((label, i) => {
          const score = i + 1; // 1–5
          const selected = value === score;
          return (
            <TouchableOpacity
              key={score}
              onPress={() => onChange(score)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${score} — ${label}`}
              className="flex-1 items-center"
            >
              <View
                className="w-8 h-8 rounded-full items-center justify-center mb-1"
                style={{
                  backgroundColor: selected ? '#006880' : 'rgba(170,179,184,0.15)',
                  borderWidth: selected ? 0 : 1.5,
                  borderColor: 'rgba(170,179,184,0.4)',
                }}
              >
                <Text
                  className="text-xs font-extrabold"
                  style={{ color: selected ? '#f1faff' : '#737c80' }}
                >
                  {score}
                </Text>
              </View>
              {score === 1 || score === 5 ? (
                <Text className="text-center text-on-surface-variant" style={{ fontSize: 8, lineHeight: 12 }}>
                  {label}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({
  scores,
  onDone,
}: {
  scores: ReturnType<typeof computeScores>;
  onDone: () => void;
}) {
  const totalColor = impactColor(scores.total);

  return (
    <View className="flex-1 items-center justify-center px-8">
      <View
        className="w-24 h-24 rounded-full items-center justify-center mb-8"
        style={{ backgroundColor: `${totalColor}1A` }}
      >
        <Ionicons name="clipboard-outline" size={52} color={totalColor} />
      </View>

      <Text className="text-3xl font-extrabold text-on-surface text-center mb-1">
        Survey Complete
      </Text>
      <Text className="text-on-surface-variant text-center mb-10">
        MS Impact Scale — MSIS-29
      </Text>

      {/* Score card */}
      <View className="w-full bg-surface-container rounded-3xl p-6 mb-6">
        <View className="items-center mb-6">
          <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
            Overall MS Impact Score
          </Text>
          <Text
            className="font-extrabold"
            style={{ fontSize: 72, lineHeight: 80, color: totalColor }}
          >
            {scores.total}
          </Text>
          <Text className="text-sm text-on-surface-variant mb-2">out of 100</Text>
          <View
            className="px-4 py-1.5 rounded-full"
            style={{ backgroundColor: `${totalColor}1A` }}
          >
            <Text className="text-sm font-bold" style={{ color: totalColor }}>
              {impactLabel(scores.total)}
            </Text>
          </View>
        </View>

        {/* Subscales */}
        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text
              className="text-2xl font-extrabold"
              style={{ color: impactColor(scores.physical) }}
            >
              {scores.physical}
            </Text>
            <Text className="text-xs text-on-surface-variant mt-1 text-center">Physical</Text>
          </View>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text
              className="text-2xl font-extrabold"
              style={{ color: impactColor(scores.psychological) }}
            >
              {scores.psychological}
            </Text>
            <Text className="text-xs text-on-surface-variant mt-1 text-center">Psychological</Text>
          </View>
        </View>
      </View>

      <Text className="text-xs text-on-surface-variant text-center mb-10 leading-5 px-2">
        Scores range 0–100. Lower scores indicate less impact from MS on your daily life.
        These results are stored for longitudinal tracking.
      </Text>

      <TouchableOpacity
        onPress={onDone}
        className="w-full bg-primary rounded-full py-5 items-center"
        accessibilityRole="button"
        accessibilityLabel="Back to Dashboard"
      >
        <Text className="text-on-primary font-bold text-lg">Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── MSIS29Screen ─────────────────────────────────────────────────────────────

type ScreenState = 'form' | 'saving' | 'error' | 'done';

export default function MSIS29Screen() {
  const router = useRouter();

  const [responses, setResponses] = useState<(number | null)[]>(
    Array(TOTAL_ITEMS).fill(null)
  );
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [scores, setScores] = useState<ReturnType<typeof computeScores> | null>(null);
  const [validationError, setValidationError] = useState(false);

  const answeredCount = responses.filter((r) => r !== null).length;
  const allAnswered = answeredCount === TOTAL_ITEMS;

  const setResponse = useCallback((index: number, value: number) => {
    setResponses((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setValidationError(false);
  }, []);

  async function handleSubmit() {
    if (!allAnswered) {
      setValidationError(true);
      return;
    }

    setScreenState('saving');
    setSaveError(null);

    const filledResponses = responses as number[];
    const computed = computeScores(filledResponses);
    setScores(computed);

    try {
      await saveTestResult({
        domain: 'mood',
        testType: 'MSIS29',
        data: {
          item_responses: filledResponses,
          physical_subscale: computed.physical,
          psychological_subscale: computed.psychological,
          total_score: computed.total,
          test_version: '1.0',
        } satisfies MSIS29Data,
      });
      setScreenState('done');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
      setScreenState('error');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-6 py-4"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(170,179,184,0.25)' }}
      >
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#006880" />
          </TouchableOpacity>
          <View>
            <Text className="font-bold text-lg text-on-surface">QoL Survey</Text>
            <Text className="text-xs text-on-surface-variant">MSIS-29 · Monthly</Text>
          </View>
        </View>

        <View className="bg-surface-container px-3 py-1.5 rounded-full">
          <Text className="text-xs font-bold text-on-surface-variant">
            {answeredCount}/{TOTAL_ITEMS}
          </Text>
        </View>
      </View>

      {/* Saving */}
      {screenState === 'saving' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#006880" />
          <Text className="mt-4 text-on-surface-variant font-medium">Saving results…</Text>
        </View>
      )}

      {/* Error */}
      {screenState === 'error' && (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={64} color="#a83836" />
          <Text className="text-xl font-bold text-on-surface text-center mt-6 mb-3">
            Failed to Save
          </Text>
          <Text className="text-on-surface-variant text-center mb-8">{saveError}</Text>
          <TouchableOpacity
            onPress={() => void handleSubmit()}
            className="w-full bg-primary rounded-full py-5 items-center mb-4"
          >
            <Text className="text-on-primary font-bold text-lg">Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/')}
            className="py-3 items-center"
          >
            <Text className="text-on-surface-variant">Discard and go home</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Done */}
      {screenState === 'done' && scores && (
        <ResultCard scores={scores} onDone={() => router.replace('/')} />
      )}

      {/* Form */}
      {screenState === 'form' && (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
          >
            {/* Intro */}
            <View className="mb-6">
              <Text className="text-2xl font-extrabold text-on-surface mb-2">
                How has MS affected you?
              </Text>
              <Text className="text-on-surface-variant leading-relaxed text-sm">
                In the past two weeks, how much has your MS limited you in the following areas?
              </Text>
            </View>

            {/* Progress bar */}
            <View className="h-2 bg-surface-container-highest rounded-full overflow-hidden mb-8">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${(answeredCount / TOTAL_ITEMS) * 100}%` }}
              />
            </View>

            {validationError && (
              <View
                className="rounded-2xl p-4 mb-6 flex-row items-center"
                style={{ backgroundColor: 'rgba(168,56,54,0.08)', gap: 10 }}
              >
                <Ionicons name="alert-circle-outline" size={20} color="#a83836" />
                <Text className="flex-1 text-sm text-error">
                  Please answer all {TOTAL_ITEMS} questions before submitting.
                </Text>
              </View>
            )}

            {/* Physical section */}
            <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
              <View className="w-8 h-8 rounded-xl bg-primary-container items-center justify-center">
                <Ionicons name="body-outline" size={16} color="#004a5d" />
              </View>
              <Text className="font-extrabold text-base text-on-surface">
                Physical Impact
              </Text>
              <Text className="text-xs text-on-surface-variant">
                · {PHYSICAL_ITEMS.length} items
              </Text>
            </View>

            {PHYSICAL_ITEMS.map((q, i) => (
              <ResponseRow
                key={i}
                index={i + 1}
                question={q}
                value={responses[i]}
                onChange={(v) => setResponse(i, v)}
              />
            ))}

            {/* Psychological section */}
            <View className="flex-row items-center mb-4 mt-6" style={{ gap: 8 }}>
              <View className="w-8 h-8 rounded-xl bg-tertiary-container items-center justify-center">
                <Ionicons name="heart-outline" size={16} color="#006b60" />
              </View>
              <Text className="font-extrabold text-base text-on-surface">
                Psychological Impact
              </Text>
              <Text className="text-xs text-on-surface-variant">
                · {PSYCHOLOGICAL_ITEMS.length} items
              </Text>
            </View>

            {PSYCHOLOGICAL_ITEMS.map((q, i) => {
              const idx = PHYSICAL_ITEMS.length + i;
              return (
                <ResponseRow
                  key={idx}
                  index={idx + 1}
                  question={q}
                  value={responses[idx]}
                  onChange={(v) => setResponse(idx, v)}
                />
              );
            })}
          </ScrollView>

          {/* Fixed CTA */}
          <View
            className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4 bg-surface"
            style={{ borderTopWidth: 1, borderTopColor: 'rgba(170,179,184,0.2)' }}
          >
            <TouchableOpacity
              onPress={() => void handleSubmit()}
              className="w-full bg-primary rounded-full py-5 flex-row items-center justify-center"
              style={{ gap: 10, opacity: allAnswered ? 1 : 0.55 }}
              accessibilityRole="button"
              accessibilityLabel="Submit MSIS-29 questionnaire"
            >
              <Text className="text-on-primary font-bold text-lg">Submit Survey</Text>
              <Ionicons name="checkmark-circle-outline" size={22} color="#f1faff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

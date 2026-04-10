import { useCallback, useMemo, useState } from 'react';
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
import { getLocalizedErrorMessage, useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import { saveTestResult } from '../../lib/saveTestResult';
import type { MSIS29Data } from '../../lib/types';

function computeScores(responses: number[]) {
  const physicalSum = responses.slice(0, 20).reduce((total, value) => total + value, 0);
  const psychologicalSum = responses.slice(20, 29).reduce((total, value) => total + value, 0);

  const physical = ((physicalSum - 20) / 80) * 100;
  const psychological = ((psychologicalSum - 9) / 36) * 100;
  const total = (physical + psychological) / 2;

  return {
    physical: Math.round(physical * 10) / 10,
    psychological: Math.round(psychological * 10) / 10,
    total: Math.round(total * 10) / 10,
  };
}

function impactColor(score: number): string {
  if (score <= 25) return '#006b60';
  if (score <= 50) return '#005b71';
  if (score <= 75) return '#b97c00';
  return '#a83836';
}

function impactLabel(score: number, messages: ReturnType<typeof useLocalization>['messages']): string {
  if (score <= 25) return messages.msis29.lowImpact;
  if (score <= 50) return messages.msis29.moderateImpact;
  if (score <= 75) return messages.msis29.highImpact;
  return messages.msis29.veryHighImpact;
}

function ResponseRow({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const { formatMessage, messages, row, textAlign } = useLocalization();

  return (
    <View
      className="bg-surface-container rounded-2xl p-4 mb-3"
      style={value !== null ? { borderWidth: 1, borderColor: 'rgba(0,104,128,0.2)' } : undefined}
    >
      <Text className="text-sm font-semibold text-on-surface mb-3 leading-5" style={textAlign}>
        <Text className="text-primary font-bold">{index}. </Text>
        {question}
      </Text>
      <View style={[row, { gap: 6 }]}>
        {messages.msis29.responseLabels.map((label, i) => {
          const score = i + 1;
          const selected = value === score;
          return (
            <TouchableOpacity
              key={score}
              onPress={() => onChange(score)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={formatMessage(messages.msis29.responseA11y, { score, label })}
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
                <Text className="text-xs font-extrabold" style={{ color: selected ? '#f1faff' : '#737c80' }}>
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

function ResultCard({
  scores,
  onDone,
}: {
  scores: ReturnType<typeof computeScores>;
  onDone: () => void;
}) {
  const { formatNumber, messages, row, textAlign } = useLocalization();
  const totalColor = impactColor(scores.total);

  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-24 h-24 rounded-full items-center justify-center mb-8" style={{ backgroundColor: `${totalColor}1A` }}>
        <Ionicons name="clipboard-outline" size={52} color={totalColor} />
      </View>

      <Text className="text-2xl font-extrabold text-on-surface text-center mb-1" style={textAlign}>
        {messages.msis29.completeTitle}
      </Text>
      <Text className="text-on-surface-variant text-center mb-10" style={textAlign}>
        {messages.msis29.completeSubtitle}
      </Text>

      <View className="w-full bg-surface-container rounded-3xl p-6 mb-6">
        <View className="items-center mb-6">
          <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
            {messages.msis29.overallScore}
          </Text>
          <Text className="font-extrabold" style={{ fontSize: 52, lineHeight: 60, color: totalColor }}>
            {formatNumber(scores.total)}
          </Text>
          <Text className="text-sm text-on-surface-variant mb-2">{messages.msis29.outOfHundred}</Text>
          <View className="px-4 py-1.5 rounded-full" style={{ backgroundColor: `${totalColor}1A` }}>
            <Text className="text-sm font-bold" style={{ color: totalColor }}>
              {impactLabel(scores.total, messages)}
            </Text>
          </View>
        </View>

        <View style={[row, { gap: 10 }]}>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text className="text-2xl font-extrabold" style={{ color: impactColor(scores.physical) }}>
              {formatNumber(scores.physical)}
            </Text>
            <Text className="text-xs text-on-surface-variant mt-1 text-center">{messages.msis29.physical}</Text>
          </View>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text className="text-2xl font-extrabold" style={{ color: impactColor(scores.psychological) }}>
              {formatNumber(scores.psychological)}
            </Text>
            <Text className="text-xs text-on-surface-variant mt-1 text-center">{messages.msis29.psychological}</Text>
          </View>
        </View>
      </View>

      <Text className="text-xs text-on-surface-variant text-center mb-10 leading-5 px-2" style={textAlign}>
        {messages.msis29.scoreNote}
      </Text>

      <TouchableOpacity
        onPress={onDone}
        className="w-full bg-primary rounded-full py-5 items-center"
        accessibilityRole="button"
        accessibilityLabel={messages.common.backToDashboard}
      >
        <Text className="text-on-primary font-bold text-lg">{messages.common.backToDashboard}</Text>
      </TouchableOpacity>
    </View>
  );
}

type ScreenState = 'form' | 'saving' | 'error' | 'done';

export default function MSIS29Screen() {
  const router = useRouter();
  const { backIcon, formatMessage, formatNumber, messages, row, textAlign } = useLocalization();

  const physicalItems = messages.msis29.physicalItems;
  const psychologicalItems = messages.msis29.psychologicalItems;
  const totalItems = physicalItems.length + psychologicalItems.length;

  const [responses, setResponses] = useState<(number | null)[]>(Array(totalItems).fill(null));
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [scores, setScores] = useState<ReturnType<typeof computeScores> | null>(null);
  const [validationError, setValidationError] = useState(false);

  const answeredCount = useMemo(() => responses.filter((value) => value !== null).length, [responses]);
  const allAnswered = answeredCount === totalItems;

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
    } catch (error) {
      setSaveError(getLocalizedErrorMessage(error, messages, messages.common.saveFailed));
      setScreenState('error');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <View
        className="items-center justify-between px-6 py-4"
        style={[row, { borderBottomWidth: 1, borderBottomColor: 'rgba(170,179,184,0.25)' }]}
      >
        <View className="items-center" style={row}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel={messages.common.back}
          >
            <Ionicons name={backIcon} size={24} color="#006880" />
          </TouchableOpacity>
          <View style={{ marginStart: 12 }}>
            <Text className="font-bold text-lg text-on-surface" style={textAlign}>
              {messages.msis29.title}
            </Text>
            <Text className="text-xs text-on-surface-variant" style={textAlign}>
              {messages.msis29.subtitle}
            </Text>
          </View>
        </View>

        <View className="bg-surface-container px-3 py-1.5 rounded-full">
          <Text className="text-xs font-bold text-on-surface-variant">
            {formatNumber(answeredCount)}/{formatNumber(totalItems)}
          </Text>
        </View>
      </View>

      {screenState === 'saving' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#006880" />
          <Text className="mt-4 text-on-surface-variant font-medium">{messages.msis29.saving}</Text>
        </View>
      ) : null}

      {screenState === 'error' ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={64} color="#a83836" />
          <Text className="text-xl font-bold text-on-surface text-center mt-6 mb-3" style={textAlign}>
            {messages.common.failedToSave}
          </Text>
          <Text className="text-on-surface-variant text-center mb-8" style={textAlign}>{saveError}</Text>
          <TouchableOpacity onPress={() => void handleSubmit()} className="w-full bg-primary rounded-full py-5 items-center mb-4">
            <Text className="text-on-primary font-bold text-lg">{messages.common.retry}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/')} className="py-3 items-center">
            <Text className="text-on-surface-variant">{messages.common.discardAndGoHome}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {screenState === 'done' && scores ? <ResultCard scores={scores} onDone={() => router.replace('/')} /> : null}

      {screenState === 'form' ? (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
          >
            <View className="mb-6">
              <Text className="text-2xl font-extrabold text-on-surface mb-2" style={textAlign}>
                {messages.msis29.introTitle}
              </Text>
              <Text className="text-on-surface-variant leading-relaxed text-sm" style={textAlign}>
                {messages.msis29.introBody}
              </Text>
            </View>

            <View className="h-2 bg-surface-container-highest rounded-full overflow-hidden mb-8">
              <View className="h-full bg-primary rounded-full" style={{ width: `${(answeredCount / totalItems) * 100}%` }} />
            </View>

            {validationError ? (
              <View className="rounded-2xl p-4 mb-6 items-center" style={[row, { backgroundColor: 'rgba(168,56,54,0.08)', gap: 10 }]}>
                <Ionicons name="alert-circle-outline" size={20} color="#a83836" />
                <Text className="flex-1 text-sm text-error" style={textAlign}>
                  {formatMessage(messages.msis29.validationError, { count: formatNumber(totalItems) })}
                </Text>
              </View>
            ) : null}

            <View className="items-center mb-4" style={row}>
              <View className="w-8 h-8 rounded-xl bg-primary-container items-center justify-center" style={{ marginEnd: 8 }}>
                <Ionicons name="body-outline" size={16} color="#004a5d" />
              </View>
              <Text className="font-extrabold text-base text-on-surface" style={textAlign}>
                {messages.msis29.physicalImpact}
              </Text>
              <Text className="text-xs text-on-surface-variant" style={{ marginStart: 8 }}>
                · {formatMessage(messages.msis29.itemsCount, { count: formatNumber(physicalItems.length) })}
              </Text>
            </View>

            {physicalItems.map((question, index) => (
              <ResponseRow
                key={`physical-${index}`}
                index={index + 1}
                question={question}
                value={responses[index]}
                onChange={(value) => setResponse(index, value)}
              />
            ))}

            <View className="items-center mb-4 mt-6" style={row}>
              <View className="w-8 h-8 rounded-xl bg-tertiary-container items-center justify-center" style={{ marginEnd: 8 }}>
                <Ionicons name="heart-outline" size={16} color="#006b60" />
              </View>
              <Text className="font-extrabold text-base text-on-surface" style={textAlign}>
                {messages.msis29.psychologicalImpact}
              </Text>
              <Text className="text-xs text-on-surface-variant" style={{ marginStart: 8 }}>
                · {formatMessage(messages.msis29.itemsCount, { count: formatNumber(psychologicalItems.length) })}
              </Text>
            </View>

            {psychologicalItems.map((question, index) => {
              const responseIndex = physicalItems.length + index;
              return (
                <ResponseRow
                  key={`psychological-${responseIndex}`}
                  index={responseIndex + 1}
                  question={question}
                  value={responses[responseIndex]}
                  onChange={(value) => setResponse(responseIndex, value)}
                />
              );
            })}
          </ScrollView>

          <View
            className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4 bg-surface"
            style={{ borderTopWidth: 1, borderTopColor: 'rgba(170,179,184,0.2)' }}
          >
            <TouchableOpacity
              onPress={() => void handleSubmit()}
              className="w-full bg-primary rounded-full py-5 items-center justify-center"
              style={[row, { gap: 10, opacity: allAnswered ? 1 : 0.55 }]}
              accessibilityRole="button"
              accessibilityLabel={messages.msis29.submitA11y}
            >
              <Text className="text-on-primary font-bold text-lg">{messages.msis29.submitSurvey}</Text>
              <Ionicons name="checkmark-circle-outline" size={22} color="#f1faff" />
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

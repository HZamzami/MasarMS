import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalization } from '../../lib/i18n';
import { saveTestResult } from '../../lib/saveTestResult';
import type { VisionContrastData } from '../../lib/types';

// ─── Staircase config ─────────────────────────────────────────────────────────

/**
 * Letters chosen for similar visual complexity (Sloan-adjacent set).
 * The 3×3 grid matches the Stitch design exactly.
 */
const LETTER_ROWS = [
  ['E', 'F', 'P'],
  ['T', 'O', 'Z'],
  ['L', 'D', 'H'],
] as const;

type Letter = 'E' | 'F' | 'P' | 'T' | 'O' | 'Z' | 'L' | 'D' | 'H';
const ALL_LETTERS: Letter[] = ['E', 'F', 'P', 'T', 'O', 'Z', 'L', 'D', 'H'];

/**
 * Asymmetric staircase: step down faster (approaching threshold),
 * step up slower (recovering after failure) — standard in psychophysics.
 */
const STEP_DOWN = 0.10; // correct  → opacity − 10% (harder)
const STEP_UP   = 0.15; // wrong    → opacity + 15% (easier)
const MIN_OPACITY = 0.10;
const MAX_OPACITY = 1.00;
/** End test after this many consecutive failures at a level. */
const FAIL_THRESHOLD = 3;

type ScreenState = 'running' | 'saving' | 'error' | 'done';
type Feedback = 'correct' | 'wrong' | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom(exclude: Letter): Letter {
  const pool = ALL_LETTERS.filter((l) => l !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── LetterButton ─────────────────────────────────────────────────────────────

function LetterButton({
  letter,
  onPress,
  disabled,
}: {
  letter: Letter;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      accessibilityRole="button"
      accessibilityLabel={`Letter ${letter}`}
      activeOpacity={0.65}
      className="flex-1 rounded-2xl bg-surface-container items-center justify-center"
      style={{ aspectRatio: 1, opacity: disabled ? 0.5 : 1 }}
    >
      <Text className="font-extrabold text-on-surface" style={{ fontSize: 32 }}>
        {letter}
      </Text>
    </TouchableOpacity>
  );
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({
  threshold,
  correct,
  attempts,
  onDone,
}: {
  threshold: number;
  correct: number;
  attempts: number;
  onDone: () => void;
}) {
  const { formatMessage, formatNumber, messages, textAlign } = useLocalization();
  const sensitivityScore = Math.round((1 - threshold) * 100);

  const tier =
    sensitivityScore >= 80
      ? { label: messages.vision.tierNormal, color: '#006b60' }
      : sensitivityScore >= 60
      ? { label: messages.vision.tierMild, color: '#005b71' }
      : sensitivityScore >= 40
      ? { label: messages.vision.tierModerate, color: '#506076' }
      : { label: messages.vision.tierSevere, color: '#a83836' };

  const accuracyPct =
    attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

  return (
    <View className="flex-1 items-center justify-center px-8">
      {/* Icon */}
      <View
        className="w-24 h-24 rounded-full items-center justify-center mb-8"
        style={{ backgroundColor: `${tier.color}1A` }}
      >
        <Ionicons name="eye-outline" size={52} color={tier.color} />
      </View>

      <Text className="text-3xl font-extrabold text-on-surface text-center mb-1">
        {messages.vision.completeTitle}
      </Text>
      <Text className="text-on-surface-variant text-center mb-10">
        {messages.vision.completeSubtitle}
      </Text>

      {/* Score card */}
      <View className="w-full bg-surface-container rounded-3xl p-6 mb-6">
        <View className="items-center mb-6">
          <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
            {messages.vision.sensitivityScore}
          </Text>
          <Text
            className="font-extrabold"
            style={{ fontSize: 72, lineHeight: 80, color: tier.color }}
          >
            {sensitivityScore}%
          </Text>
          <View
            className="mt-3 px-4 py-1.5 rounded-full"
            style={{ backgroundColor: `${tier.color}1A` }}
          >
            <Text className="text-sm font-bold" style={{ color: tier.color }}>
              {tier.label}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text className="text-2xl font-extrabold text-primary">{formatNumber(correct)}</Text>
            <Text className="text-xs text-on-surface-variant mt-1">{messages.vision.correct}</Text>
          </View>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text className="text-2xl font-extrabold text-on-surface">{formatNumber(accuracyPct)}%</Text>
            <Text className="text-xs text-on-surface-variant mt-1">{messages.vision.accuracy}</Text>
          </View>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text className="text-2xl font-extrabold text-on-surface-variant">
              {formatNumber(Math.round(threshold * 100))}%
            </Text>
            <Text className="text-xs text-on-surface-variant mt-1">{messages.vision.threshold}</Text>
          </View>
        </View>
      </View>

      <Text className="text-xs text-on-surface-variant text-center mb-10 leading-5 px-2" style={textAlign}>
        {formatMessage(messages.vision.thresholdNote, {
          threshold: formatNumber(Math.round(threshold * 100)),
        })}
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

// ─── VisionTestScreen ─────────────────────────────────────────────────────────

export default function VisionTestScreen() {
  const router = useRouter();
  const { backIcon, formatMessage, formatNumber, messages } = useLocalization();

  const [target, setTarget] = useState<Letter>('E');
  const [opacityDisplay, setOpacityDisplay] = useState(MAX_OPACITY);
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [screenState, setScreenState] = useState<ScreenState>('running');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs mirror mutable staircase values — avoids stale closures in timeouts/async
  const opacityRef        = useRef(MAX_OPACITY);
  const failsRef          = useRef(0);
  const totalCorrectRef   = useRef(0);
  const totalAttemptsRef  = useRef(0);
  const trialLogRef       = useRef<{ opacity: number; correct: boolean }[]>([]);
  const feedbackTimerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animOpacity       = useRef(new Animated.Value(MAX_OPACITY)).current;

  useEffect(() => () => { clearTimeout(feedbackTimerRef.current); }, []);

  const animateTo = useCallback(
    (toValue: number) =>
      Animated.timing(animOpacity, {
        toValue,
        duration: 400,
        useNativeDriver: true,
      }).start(),
    [animOpacity]
  );

  const finishTest = useCallback(async () => {
    setScreenState('saving');
    setSaveError(null);

    const threshold = opacityRef.current;
    const correct   = totalCorrectRef.current;
    const attempts  = totalAttemptsRef.current;

    try {
      await saveTestResult({
        domain: 'physiological',
        testType: 'ContrastSensitivity',
        data: {
          final_contrast_threshold: r2(threshold),
          total_correct_matches: correct,
          total_attempts: attempts,
          accuracy_pct: attempts > 0 ? r2((correct / attempts) * 100) : 0,
          staircase_log: trialLogRef.current,
          test_version: '1.0',
        } satisfies VisionContrastData,
      });
      setScreenState('done');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : messages.common.saveFailed);
      setScreenState('error');
    }
  }, [messages.common.saveFailed]);

  const handleLetterPress = useCallback(
    (pressed: Letter) => {
      if (screenState !== 'running' || feedback !== null) return;

      const currentOpacity = opacityRef.current;
      const isCorrect = pressed === target;

      trialLogRef.current.push({ opacity: r2(currentOpacity), correct: isCorrect });
      totalAttemptsRef.current++;
      setAttemptCount((n) => n + 1);

      void Haptics.notificationAsync(
        isCorrect
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );
      setFeedback(isCorrect ? 'correct' : 'wrong');

      if (isCorrect) {
        totalCorrectRef.current++;
        failsRef.current = 0;
        setConsecutiveFails(0);

        const next = r2(Math.max(MIN_OPACITY, currentOpacity - STEP_DOWN));
        opacityRef.current = next;

        feedbackTimerRef.current = setTimeout(() => {
          setFeedback(null);
          setOpacityDisplay(next);
          animateTo(next);
          setTarget(pickRandom(target));
        }, 350);
      } else {
        failsRef.current++;
        const newFails = failsRef.current;
        setConsecutiveFails(newFails);

        if (newFails >= FAIL_THRESHOLD) {
          // 3 consecutive failures — test ends
          feedbackTimerRef.current = setTimeout(() => {
            setFeedback(null);
            void finishTest();
          }, 600);
        } else {
          // Step back up and continue
          const next = r2(Math.min(MAX_OPACITY, currentOpacity + STEP_UP));
          opacityRef.current = next;

          feedbackTimerRef.current = setTimeout(() => {
            setFeedback(null);
            setOpacityDisplay(next);
            animateTo(next);
            setTarget(pickRandom(target));
          }, 350);
        }
      }
    },
    [screenState, feedback, target, animateTo, finishTest]
  );

  const isGridDisabled = screenState !== 'running' || feedback !== null;
  const attemptsLeft   = FAIL_THRESHOLD - consecutiveFails;
  const attemptLabel = attemptCount === 1
    ? formatMessage(messages.vision.attemptSingular, { count: formatNumber(attemptCount) })
    : formatMessage(messages.vision.attemptPlural, { count: formatNumber(attemptCount) });

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
            accessibilityLabel={messages.common.back}
          >
            <Ionicons name={backIcon} size={24} color="#006880" />
          </TouchableOpacity>
          <Text className="font-bold text-lg text-on-surface">{messages.vision.title}</Text>
        </View>

        <View className="bg-surface-container px-3 py-1.5 rounded-full">
          <Text className="text-xs font-bold text-on-surface-variant">
            {attemptLabel}
          </Text>
        </View>
      </View>

      {/* ── Saving ── */}
      {screenState === 'saving' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#006880" />
          <Text className="mt-4 text-on-surface-variant font-medium">{messages.vision.saving}</Text>
        </View>
      )}

      {/* ── Error ── */}
      {screenState === 'error' && (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={64} color="#a83836" />
          <Text className="text-xl font-bold text-on-surface text-center mt-6 mb-3">
            {messages.common.failedToSave}
          </Text>
          <Text className="text-on-surface-variant text-center mb-8">{saveError}</Text>
          <TouchableOpacity
            onPress={() => void finishTest()}
            className="w-full bg-primary rounded-full py-5 items-center mb-4"
            accessibilityRole="button"
            accessibilityLabel={messages.common.retry}
          >
            <Text className="text-on-primary font-bold text-lg">{messages.common.retry}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/')}
            className="py-3 items-center"
            accessibilityRole="button"
          >
            <Text className="text-on-surface-variant">{messages.common.discardAndGoHome}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Done ── */}
      {screenState === 'done' && (
        <ResultCard
          threshold={opacityRef.current}
          correct={totalCorrectRef.current}
          attempts={totalAttemptsRef.current}
          onDone={() => router.replace('/')}
        />
      )}

      {/* ── Running ── */}
      {(screenState === 'running' || screenState === 'saving') && screenState !== 'saving' && (
        <>
          {/* Letter canvas — flex-1 so it fills space above the bottom sheet */}
          <View
            className="flex-1 items-center justify-center"
            style={{
              backgroundColor:
                feedback === 'correct'
                  ? 'rgba(0,107,96,0.05)'
                  : feedback === 'wrong'
                  ? 'rgba(168,56,54,0.05)'
                  : 'transparent',
            }}
          >
            <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-10">
              {messages.vision.prompt}
            </Text>

            <Animated.Text
              style={{
                opacity: animOpacity,
                fontSize: 160,
                fontWeight: '900',
                color: '#2b3438',
                lineHeight: 192,
              }}
              accessibilityRole="text"
              accessibilityLabel={messages.vision.prompt}
            >
              {target}
            </Animated.Text>
          </View>

          {/* Bottom sheet */}
          <View
            className="bg-surface-container-lowest px-6 pb-10"
            style={{
              paddingTop: 24,
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              shadowColor: '#006880',
              shadowOpacity: 0.08,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: -4 },
              elevation: 8,
            }}
          >
            {/* Drag handle */}
            <View className="items-center mb-6">
              <View className="w-12 h-1.5 rounded-full bg-outline-variant" />
            </View>

            {/* 3×3 letter grid */}
            <View style={{ gap: 10 }}>
              {LETTER_ROWS.map((row, rowIdx) => (
                <View key={rowIdx} className="flex-row" style={{ gap: 10 }}>
                  {(row as readonly Letter[]).map((letter) => (
                    <LetterButton
                      key={letter}
                      letter={letter}
                      onPress={() => handleLetterPress(letter)}
                      disabled={isGridDisabled}
                    />
                  ))}
                </View>
              ))}
            </View>

            {/* Status pill */}
            <View className="mt-5 flex-row justify-center items-center" style={{ gap: 8 }}>
              <View className="w-2 h-2 rounded-full bg-tertiary" />
              <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                {formatMessage(messages.vision.contrastStatus, {
                  contrast: formatNumber(Math.round(opacityDisplay * 100)),
                  suffix: consecutiveFails > 0
                    ? formatMessage(messages.vision.leftBeforeEnd, { count: formatNumber(attemptsLeft) })
                    : '',
                })}
              </Text>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

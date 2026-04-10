import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CountdownOverlay } from '../../lib/CountdownOverlay';
import { getLocalizedErrorMessage, useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import { saveTestResult } from '../../lib/saveTestResult';
import type { PinchDragData } from '../../lib/types';

// ─── Config ───────────────────────────────────────────────────────────────────

const TOTAL_TRIALS = 10;
const TARGET_RADIUS = 44;     // px — landing zone radius
const TOKEN_SIZE   = 56;      // px — draggable token diameter

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrialResult {
  errorPx: number;       // distance from drop center to target center
  timeMs: number;        // ms from grab to drop
  success: boolean;      // landed within TARGET_RADIUS
}

type ScreenState = 'instructions' | 'selection' | 'countdown' | 'running' | 'saving' | 'error' | 'done';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({
  trials,
  onDone,
}: {
  trials: TrialResult[];
  onDone: () => void;
}) {
  const { messages } = useLocalization();
  const successCount = trials.filter((t) => t.success).length;
  const accuracyPct  = Math.round((successCount / trials.length) * 100);
  const errors       = trials.map((t) => t.errorPx);
  const meanError    = r1(errors.reduce((a, b) => a + b, 0) / errors.length);
  const times        = trials.map((t) => t.timeMs);
  const medianTime   = r1(median(times));

  const tier =
    accuracyPct >= 90
      ? { label: messages.pinchDrag.tiers.excellent, color: '#006b60' }
      : accuracyPct >= 70
      ? { label: messages.pinchDrag.tiers.good, color: '#005b71' }
      : accuracyPct >= 50
      ? { label: messages.pinchDrag.tiers.fair, color: '#b97c00' }
      : { label: messages.pinchDrag.tiers.impaired, color: '#a83836' };

  return (
    <View className="flex-1 items-center justify-center px-8">
      <View
        className="w-24 h-24 rounded-full items-center justify-center mb-8"
        style={{ backgroundColor: `${tier.color}1A` }}
      >
        <Ionicons name="hand-left-outline" size={52} color={tier.color} />
      </View>

      <Text className="text-2xl font-extrabold text-on-surface text-center mb-1">
        {messages.pinchDrag.resultTitle}
      </Text>
      <Text className="text-on-surface-variant text-center mb-10">
        {messages.pinchDrag.resultSubtitle}
      </Text>

      <View className="w-full bg-surface-container rounded-3xl p-6 mb-6">
        <View className="items-center mb-6">
          <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
            {messages.pinchDrag.accuracy}
          </Text>
          <Text
            className="font-extrabold"
            style={{ fontSize: 52, lineHeight: 60, color: tier.color }}
          >
            {accuracyPct}%
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

        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text className="text-2xl font-extrabold text-primary">{successCount}/{trials.length}</Text>
            <Text className="text-xs text-on-surface-variant mt-1">{messages.pinchDrag.successful}</Text>
          </View>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text className="text-2xl font-extrabold text-on-surface">{meanError}</Text>
            <Text className="text-xs text-on-surface-variant mt-1">{messages.pinchDrag.averageError}</Text>
          </View>
          <View className="flex-1 bg-surface-container-high rounded-2xl p-4 items-center">
            <Text className="text-2xl font-extrabold text-on-surface-variant">{medianTime}</Text>
            <Text className="text-xs text-on-surface-variant mt-1">{messages.pinchDrag.medianTime}</Text>
          </View>
        </View>
      </View>

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

// ─── PinchDragScreen ──────────────────────────────────────────────────────────

export default function PinchDragScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { backIcon, formatMessage, messages } = useLocalization();

  const [screenState, setScreenState] = useState<ScreenState>('instructions');
  const [dominantHand, setDominantHand] = useState<boolean | null>(null);
  const [trialIndex, setTrialIndex] = useState(0);
  const [trials, setTrials] = useState<TrialResult[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Token animated position (starts off-screen, reset each trial)
  const tokenPos    = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const tokenOffset = useRef({ x: 0, y: 0 });
  const grabTimeRef = useRef<number>(0);
  const isDragging  = useRef(false);

  // Target position — randomised each trial
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  // Token start position — fixed bottom-centre of play area
  const tokenStartX = width / 2 - TOKEN_SIZE / 2;
  const tokenStartY = height * 0.72 - TOKEN_SIZE / 2;

  const generateTarget = useCallback(() => {
    const padding = TARGET_RADIUS + 20;
    const playH = height * 0.55; // upper portion of screen
    const tx = padding + Math.random() * (width - padding * 2);
    const ty = 120 + Math.random() * (playH - 120 - padding);
    setTargetPos({ x: tx, y: ty });
  }, [width, height]);

  const resetToken = useCallback(() => {
    tokenPos.setValue({ x: tokenStartX, y: tokenStartY });
    tokenOffset.current = { x: tokenStartX, y: tokenStartY };
    isDragging.current = false;
  }, [tokenPos, tokenStartX, tokenStartY]);

  useEffect(() => {
    if (screenState === 'running') {
      generateTarget();
      resetToken();
    }
  }, [generateTarget, resetToken, screenState, trialIndex]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => screenState === 'running' && !isDragging.current,
    onMoveShouldSetPanResponder: () => screenState === 'running',

    onPanResponderGrant: (_, gs) => {
      isDragging.current = true;
      grabTimeRef.current = Date.now();
      tokenOffset.current = {
        x: tokenStartX,
        y: tokenStartY,
      };
      tokenPos.setOffset(tokenOffset.current);
      tokenPos.setValue({ x: 0, y: 0 });
    },

    onPanResponderMove: Animated.event(
      [null, { dx: tokenPos.x, dy: tokenPos.y }],
      { useNativeDriver: false }
    ),

    onPanResponderRelease: (_, gs) => {
      isDragging.current = false;
      tokenPos.flattenOffset();

      // Final position of token center
      const dropX = tokenStartX + TOKEN_SIZE / 2 + gs.dx;
      const dropY = tokenStartY + TOKEN_SIZE / 2 + gs.dy;

      const err  = distance(dropX, dropY, targetPos.x, targetPos.y);
      const time = Date.now() - grabTimeRef.current;
      const hit  = err <= TARGET_RADIUS;

      void Haptics.notificationAsync(
        hit
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );

      const result: TrialResult = {
        errorPx: Math.round(err),
        timeMs:  time,
        success: hit,
      };

      const newTrials = [...trials, result];
      setTrials(newTrials);

      if (newTrials.length >= TOTAL_TRIALS) {
        void finishTest(newTrials);
      } else {
        // Brief pause then next trial
        setTimeout(() => {
          setTrialIndex((n) => n + 1);
        }, 400);
      }
    },
  });

  const finishTest = useCallback(async (finalTrials: TrialResult[]) => {
    setScreenState('saving');
    setSaveError(null);

    const errors    = finalTrials.map((t) => t.errorPx);
    const times     = finalTrials.map((t) => t.timeMs);
    const successes = finalTrials.filter((t) => t.success).length;

    try {
      await saveTestResult({
        domain: 'motor',
        testType: 'PinchDrag',
        data: {
          mean_error_px:    r1(errors.reduce((a, b) => a + b, 0) / errors.length),
          error_stddev_px:  r1(stddev(errors)),
          trial_count:      finalTrials.length,
          median_time_ms:   r1(median(times)),
          miss_count:       finalTrials.length - successes,
          accuracy_pct:     r1((successes / finalTrials.length) * 100),
          dominant_hand:    dominantHand,
          test_version:     '1.0',
        } satisfies PinchDragData,
      });
      setScreenState('done');
    } catch (err) {
      setSaveError(getLocalizedErrorMessage(err, messages, messages.common.saveFailed));
      setScreenState('error');
    }
  }, [dominantHand, messages]);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
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
          <Text className="font-bold text-lg text-on-surface">{messages.pinchDrag.title}</Text>
        </View>
        {screenState === 'running' && (
          <View className="bg-surface-container px-3 py-1.5 rounded-full">
            <Text className="text-xs font-bold text-on-surface-variant">
              {trials.length + 1} / {TOTAL_TRIALS}
            </Text>
          </View>
        )}
      </View>

      {/* Saving */}
      {screenState === 'saving' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#006880" />
          <Text className="mt-4 text-on-surface-variant font-medium">{messages.common.saveResults}</Text>
        </View>
      )}

      {/* Error */}
      {screenState === 'error' && (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={64} color="#a83836" />
          <Text className="text-xl font-bold text-on-surface text-center mt-6 mb-3">{messages.common.failedToSave}</Text>
          <Text className="text-on-surface-variant text-center mb-8">{saveError}</Text>
          <TouchableOpacity onPress={() => void finishTest(trials)} className="w-full bg-primary rounded-full py-5 items-center mb-4">
            <Text className="text-on-primary font-bold text-lg">{messages.common.retry}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/')} className="py-3 items-center">
            <Text className="text-on-surface-variant">{messages.common.discardAndGoHome}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Done */}
      {screenState === 'done' && (
        <ResultCard trials={trials} onDone={() => router.replace('/')} />
      )}

      {/* Countdown */}
      {screenState === 'countdown' && (
        <View className="flex-1">
          {/* We render the running UI behind the countdown */}
          <View className="flex-1 opacity-40">
            {/* Target ring */}
            <View
              style={{
                position: 'absolute',
                left: width / 2 - TARGET_RADIUS,
                top: height / 4 - TARGET_RADIUS,
                width: TARGET_RADIUS * 2,
                height: TARGET_RADIUS * 2,
                borderRadius: TARGET_RADIUS,
                borderWidth: 2.5,
                borderColor: '#006880',
              }}
            />
            {/* Draggable token */}
            <View
              style={{
                position: 'absolute',
                left: tokenStartX,
                top: tokenStartY,
                width: TOKEN_SIZE,
                height: TOKEN_SIZE,
                borderRadius: TOKEN_SIZE / 2,
                backgroundColor: '#006880',
              }}
            />
          </View>
          <CountdownOverlay onFinished={() => setScreenState('running')} />
        </View>
      )}

      {/* Selection */}
      {screenState === 'selection' && (
        <View className="flex-1 px-8 justify-center">
          <View className="w-20 h-20 rounded-3xl bg-primary-container items-center justify-center mb-8 self-center">
            <Ionicons name="hand-left-outline" size={44} color="#006880" />
          </View>
          <Text className="text-2xl font-extrabold text-on-surface text-center mb-4">
            {messages.common.selectHand}
          </Text>
          <Text className="text-on-surface-variant text-center leading-relaxed mb-10">
            {messages.pinchDrag.selectionBody}
          </Text>
          
          <View style={{ gap: 12 }} className="mb-10">
            <TouchableOpacity
              onPress={() => { setDominantHand(true); setScreenState('countdown'); }}
              className="w-full bg-surface-container-low border-2 border-primary/20 rounded-2xl p-5 flex-row items-center"
            >
              <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-4">
                <Ionicons name="star" size={20} color="#f1faff" />
              </View>
              <Text className="text-lg font-bold text-on-surface">{messages.common.dominantHand}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setDominantHand(false); setScreenState('countdown'); }}
              className="w-full bg-surface-container-low border-2 border-outline-variant/30 rounded-2xl p-5 flex-row items-center"
            >
              <View className="w-10 h-10 rounded-full bg-surface-container-highest items-center justify-center mr-4">
                <Ionicons name="hand-right-outline" size={20} color="#576065" />
              </View>
              <Text className="text-lg font-bold text-on-surface">{messages.common.nonDominantHand}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setScreenState('instructions')} className="items-center">
            <Text className="text-on-surface-variant font-bold">{messages.common.back}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Instructions */}
      {screenState === 'instructions' && (
        <View className="flex-1 px-8 justify-center">
          <View className="w-20 h-20 rounded-3xl bg-primary-container items-center justify-center mb-8 self-center">
            <Ionicons name="hand-left-outline" size={44} color="#006880" />
          </View>
          <Text className="text-2xl font-extrabold text-on-surface text-center mb-4">
            {messages.pinchDrag.title}
          </Text>
          <Text className="text-on-surface-variant text-center leading-relaxed mb-8">
            {messages.pinchDrag.instructionsBody}
          </Text>
          <View
            className="bg-surface-container-low rounded-2xl p-5 mb-10"
            style={{ gap: 12 }}
          >
            {messages.pinchDrag.instructionSteps.map((tip, i) => (
              <View key={i} className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                  <Text className="text-on-primary font-bold text-xs">{i + 1}</Text>
                </View>
                <Text className="flex-1 text-sm text-on-surface">{tip}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => setScreenState('selection')}
            className="w-full bg-primary rounded-full py-5 items-center"
          >
            <Text className="text-on-primary font-bold text-lg">{messages.common.startTest}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Running */}
      {screenState === 'running' && (
        <View className="flex-1" style={{ position: 'relative' }}>
          {/* Target ring */}
          <View
            style={{
              position: 'absolute',
              left: targetPos.x - TARGET_RADIUS,
              top: targetPos.y - TARGET_RADIUS,
              width: TARGET_RADIUS * 2,
              height: TARGET_RADIUS * 2,
              borderRadius: TARGET_RADIUS,
              borderWidth: 2.5,
              borderColor: '#006880',
              backgroundColor: 'rgba(0,104,128,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: '#006880',
              }}
            />
          </View>

          {/* Draggable token */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: TOKEN_SIZE,
                height: TOKEN_SIZE,
                borderRadius: TOKEN_SIZE / 2,
                backgroundColor: '#006880',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#006880',
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 8,
              },
              tokenPos.getLayout(),
            ]}
            {...panResponder.panHandlers}
          >
            <Ionicons name="hand-left" size={26} color="#f1faff" />
          </Animated.View>

          {/* Instructions overlay */}
          <View
            style={{ position: 'absolute', bottom: 40, left: 0, right: 0 }}
            className="items-center"
          >
            <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
              {formatMessage(messages.pinchDrag.trialInstruction, {
                current: trials.length + 1,
                total: TOTAL_TRIALS,
              })}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { saveTestResult } from '../../lib/saveTestResult';
import type { FingerTappingData } from '../../lib/types';

const TEST_DURATION_MS  = 10_000;
const HALF_WINDOW_MS    = TEST_DURATION_MS / 2;

type TapSample = { timestamp: number };

function formatCountdown(remainingMs: number) {
  const clamped      = Math.max(0, remainingMs);
  const seconds      = Math.floor(clamped / 1000);
  const centiseconds = Math.floor((clamped % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`;
}

function computeMetrics(taps: TapSample[]) {
  const total     = taps.length;
  const firstHalf = taps.filter((t) => t.timestamp <= HALF_WINDOW_MS).length;
  const lastHalf  = taps.filter((t) => t.timestamp > HALF_WINDOW_MS).length;

  const f1 = firstHalf / 5;
  const f2 = lastHalf  / 5;
  const fatigueIndex = f2 > 0 ? f1 / f2 : f1 > 0 ? f1 : 1;

  return {
    totalTaps:   total,
    frequencyHz: total / 10,
    fatigueIndex,
  };
}

export default function MotorTappingTaskScreen() {
  const router = useRouter();

  const [remainingMs, setRemainingMs] = useState(TEST_DURATION_MS);
  const [highlighted, setHighlighted] = useState(false);
  const [status, setStatus]           = useState<'running' | 'saving' | 'error'>('running');
  const [saveError, setSaveError]     = useState<string | null>(null);

  const startedAtRef    = useRef<number | null>(null);
  const frameIdRef      = useRef<number | null>(null);
  const isFinishedRef   = useRef(false);
  const tapsRef         = useRef<TapSample[]>([]);

  const persistObservation = useCallback(async () => {
    setStatus('saving');
    setSaveError(null);

    const taps    = tapsRef.current;
    const metrics = computeMetrics(taps);

    try {
      await saveTestResult({
        domain:   'motor',
        testType: 'FingerTapping',
        data: {
          total_taps:      metrics.totalTaps,
          frequency_hz:    Number(metrics.frequencyHz.toFixed(4)),
          fatigue_index:   Number(metrics.fatigueIndex.toFixed(4)),
          dominant_hand:   null,
          tap_events:      taps.map((t, i) => ({ t: t.timestamp, side: (i % 2 === 0 ? 'L' : 'R') as 'L' | 'R' })),
          duration_seconds: TEST_DURATION_MS / 1000,
        } satisfies FingerTappingData,
      });

      router.replace('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.';
      setSaveError(msg.toLowerCase().includes('schema cache')
        ? 'Database table not found. Apply migration 003_unified_schema.sql, then retry.'
        : msg);
      setStatus('error');
    }
  }, [router]);

  useEffect(() => {
    const step = (now: number) => {
      if (startedAtRef.current === null) startedAtRef.current = now;
      const elapsed   = now - startedAtRef.current;
      const remaining = Math.max(0, TEST_DURATION_MS - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0) {
        if (!isFinishedRef.current) {
          isFinishedRef.current = true;
          void persistObservation();
        }
        return;
      }
      frameIdRef.current = requestAnimationFrame(step);
    };

    frameIdRef.current = requestAnimationFrame(step);
    return () => {
      if (frameIdRef.current !== null) cancelAnimationFrame(frameIdRef.current);
    };
  }, [persistObservation]);

  const handleTap = useCallback(() => {
    if (status !== 'running' || isFinishedRef.current) return;
    if (startedAtRef.current === null) return;

    const tapTimestamp = performance.now() - startedAtRef.current;
    if (tapTimestamp < 0 || tapTimestamp > TEST_DURATION_MS) return;

    tapsRef.current.push({ timestamp: Number(tapTimestamp.toFixed(3)) });
    setHighlighted(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setTimeout(() => setHighlighted(false), 80);
  }, [status]);

  const timerLabel  = useMemo(() => formatCountdown(remainingMs), [remainingMs]);
  const tapCount    = tapsRef.current.length;
  const isDisabled  = status !== 'running';
  const pct         = 1 - remainingMs / TEST_DURATION_MS;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 px-6 pb-6">

        {/* Header */}
        <View className="flex-row items-center justify-between py-4">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Pressable
              className="w-10 h-10 rounded-full items-center justify-center"
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={20}
            >
              <Ionicons name="arrow-back" size={24} color="#006880" />
            </Pressable>
            <Text className="text-xl font-bold text-on-surface">Finger Tapping</Text>
          </View>

          <View className="bg-surface-container px-3 py-1.5 rounded-full">
            <Text className="text-xs font-bold text-on-surface-variant">
              {tapCount} taps
            </Text>
          </View>
        </View>

        {/* Timer */}
        <View className="mt-2 rounded-3xl bg-surface-container-low px-8 py-6 items-center">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Ionicons name="timer-outline" size={16} color="#006880" />
            <Text className="text-sm font-semibold tracking-widest uppercase text-on-surface-variant">
              Time Remaining
            </Text>
          </View>
          <Text className="mt-2 font-extrabold text-primary" style={{ fontSize: 64, lineHeight: 72 }}>
            {timerLabel}
          </Text>

          {/* Progress track */}
          <View className="w-full mt-4 h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${pct * 100}%` }}
            />
          </View>
        </View>

        {/* Instructions */}
        <View className="items-center mt-8">
          <Text className="text-xl font-bold text-on-surface mb-2">
            Tap as fast as you can
          </Text>
          <Text className="text-center text-on-surface-variant text-sm leading-6 px-4">
            Use your <Text className="font-bold text-primary">index finger</Text> to tap
            the button below repeatedly for 10 seconds.
          </Text>
        </View>

        {/* Single tap button */}
        <View className="flex-1 items-center justify-center">
          <Pressable
            disabled={isDisabled}
            onPressIn={handleTap}
            hitSlop={24}
            accessibilityRole="button"
            accessibilityLabel="Tap here"
            style={({ pressed }) => ({
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: highlighted ? '#72d9fd' : '#dbe4e9',
              borderWidth: 4,
              borderColor: 'rgba(0,104,128,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: highlighted ? 0.92 : 1 }],
              shadowColor: '#006880',
              shadowOpacity: highlighted ? 0.22 : 0.06,
              shadowRadius: highlighted ? 20 : 10,
              elevation: highlighted ? 8 : 3,
              opacity: isDisabled ? 0.5 : 1,
            })}
          >
            <Ionicons name="hand-left" size={64} color="#006880" />
          </Pressable>
        </View>

        {/* Tip */}
        <View
          className="rounded-2xl px-4 py-4 flex-row items-center"
          style={{ gap: 12, backgroundColor: 'rgba(101,253,230,0.15)', borderWidth: 1, borderColor: 'rgba(0,107,96,0.1)' }}
        >
          <View className="w-8 h-8 rounded-lg bg-tertiary items-center justify-center">
            <Ionicons name="information-circle" size={16} color="#e2fff8" />
          </View>
          <Text className="flex-1 text-sm font-medium text-on-tertiary-container">
            Rest your wrist on a flat surface. Tap with your dominant hand's index finger.
          </Text>
        </View>

        {/* Status messages */}
        {status === 'saving' && (
          <View className="items-center mt-4">
            <Text className="text-sm text-primary">Saving result…</Text>
          </View>
        )}
        {status === 'error' && (
          <View className="items-center mt-4">
            <Text className="text-xs text-error text-center mb-2">{saveError}</Text>
            <Pressable
              className="px-5 py-2.5 rounded-full bg-primary"
              onPress={() => void persistObservation()}
              hitSlop={20}
            >
              <Text className="text-on-primary font-semibold">Retry Save</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

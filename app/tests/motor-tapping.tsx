import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

const TEST_DURATION_MS = 10_000;
const HALF_WINDOW_MS = TEST_DURATION_MS / 2;

type TapSide = 'L' | 'R';
type TapSample = { timestamp: number; side: TapSide };

type MotorMetrics = {
  totalTaps: number;
  frequencyHz: number;
  fatigueIndex: number;
};

function formatCountdown(remainingMs: number) {
  const clamped = Math.max(0, remainingMs);
  const seconds = Math.floor(clamped / 1000);
  const centiseconds = Math.floor((clamped % 1000) / 10);
  return `${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`;
}

function computeMetrics(taps: TapSample[]): MotorMetrics {
  const totalTaps = taps.length;
  const firstHalfTaps = taps.filter((tap) => tap.timestamp <= HALF_WINDOW_MS).length;
  const lastHalfTaps = taps.filter((tap) => tap.timestamp > HALF_WINDOW_MS).length;

  const firstHalfFrequency = firstHalfTaps / 5;
  const lastHalfFrequency = lastHalfTaps / 5;
  const fatigueIndex =
    lastHalfFrequency > 0
      ? firstHalfFrequency / lastHalfFrequency
      : firstHalfFrequency > 0
        ? firstHalfFrequency
        : 1;

  return {
    totalTaps,
    frequencyHz: totalTaps / 10,
    fatigueIndex,
  };
}

function extractErrorMessage(error: unknown): string {
  if (!error) return 'Unknown save error.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    const maybeDetails = (error as { details?: unknown }).details;
    const maybeHint = (error as { hint?: unknown }).hint;
    const messagePart = typeof maybeMessage === 'string' ? maybeMessage : 'Save failed.';
    const detailsPart = typeof maybeDetails === 'string' && maybeDetails.length > 0 ? ` Details: ${maybeDetails}` : '';
    const hintPart = typeof maybeHint === 'string' && maybeHint.length > 0 ? ` Hint: ${maybeHint}` : '';
    return `${messagePart}${detailsPart}${hintPart}`;
  }
  return 'Unknown save error.';
}

function formatSaveError(error: unknown): string {
  const message = extractErrorMessage(error);
  if (
    message.toLowerCase().includes('motor_observations') &&
    message.toLowerCase().includes('schema cache')
  ) {
    return 'Database table not found. Apply migration 002_motor_observations.sql in Supabase, then retry.';
  }
  return message;
}

export default function MotorTappingTaskScreen() {
  const router = useRouter();

  const [remainingMs, setRemainingMs] = useState(TEST_DURATION_MS);
  const [selectedHand, setSelectedHand] = useState<'R' | 'L'>('R');
  const [activeSide, setActiveSide] = useState<TapSide | null>(null);
  const [status, setStatus] = useState<'running' | 'saving' | 'error'>('running');
  const [saveError, setSaveError] = useState<string | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const isFinishedRef = useRef(false);
  const tapsRef = useRef<TapSample[]>([]);
  const selectedHandRef = useRef<'R' | 'L'>('R');

  useEffect(() => {
    selectedHandRef.current = selectedHand;
  }, [selectedHand]);

  const persistObservation = useCallback(async () => {
    setStatus('saving');
    setSaveError(null);

    const taps = tapsRef.current;
    const metrics = computeMetrics(taps);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('No authenticated user found.');

      const payload = {
        user_id: user.id,
        total_taps: metrics.totalTaps,
        frequency_hz: Number(metrics.frequencyHz.toFixed(4)),
        fatigue_index: Number(metrics.fatigueIndex.toFixed(4)),
        tap_events: taps,
        duration_seconds: TEST_DURATION_MS / 1000,
        dominant_hand: selectedHandRef.current,
        device_platform: Platform.OS,
      };

      const { error: insertError } = await supabase
        .from('motor_observations')
        .insert(payload);
      if (insertError) throw insertError;

      router.replace('/(tabs)');
    } catch (error) {
      setStatus('error');
      setSaveError(formatSaveError(error));
    }
  }, [router]);

  useEffect(() => {
    const step = (now: number) => {
      if (startedAtRef.current === null) {
        startedAtRef.current = now;
      }

      const elapsed = now - startedAtRef.current;
      const remaining = Math.max(0, TEST_DURATION_MS - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0) {
        if (!isFinishedRef.current) {
          isFinishedRef.current = true;
          setRemainingMs(0);
          void persistObservation();
        }
        return;
      }

      frameIdRef.current = requestAnimationFrame(step);
    };

    frameIdRef.current = requestAnimationFrame(step);

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [persistObservation]);

  useEffect(() => {
    if (!activeSide) return;
    const timeout = setTimeout(() => setActiveSide(null), 120);
    return () => clearTimeout(timeout);
  }, [activeSide]);

  const handleTapIn = useCallback((side: TapSide) => {
    if (status !== 'running' || isFinishedRef.current) return;
    if (startedAtRef.current === null) return;

    const tapTimestamp = performance.now() - startedAtRef.current;
    if (tapTimestamp < 0 || tapTimestamp > TEST_DURATION_MS) return;

    tapsRef.current.push({
      timestamp: Number(tapTimestamp.toFixed(3)),
      side,
    });
    setActiveSide(side);
  }, [status]);

  const timerLabel = useMemo(() => formatCountdown(remainingMs), [remainingMs]);

  const isDisabled = status !== 'running';

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 px-6 pb-6">
        {/* Top App Bar */}
        <View className="flex-row items-center justify-between py-4">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Pressable
              className="w-10 h-10 rounded-full items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={20}
            >
              <Ionicons name="menu-outline" size={24} color="#006880" />
            </Pressable>
            <Text className="text-xl font-bold text-primary">MasarMS</Text>
          </View>

          <View
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{
              backgroundColor: '#dbe4e9',
              borderWidth: 2,
              borderColor: '#72d9fd',
            }}
          >
            <Ionicons name="person" size={20} color="#006880" />
          </View>
        </View>

        {/* Timer Card */}
        <View className="mt-2 rounded-[32px] bg-surface-container-low px-8 py-6 items-center">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Ionicons name="timer-outline" size={16} color="#006880" />
            <Text className="text-sm font-semibold tracking-[2px] uppercase text-on-surface-variant">
              Time Remaining
            </Text>
          </View>

          <Text className="mt-2 text-[60px] leading-[68px] font-extrabold text-primary">
            {timerLabel}
          </Text>

          <View className="mt-8 w-full rounded-full bg-surface-container-highest p-1.5 flex-row">
            <Pressable
              onPress={() => setSelectedHand('R')}
              className={`flex-1 py-2 rounded-full items-center ${
                selectedHand === 'R' ? 'bg-primary' : 'bg-transparent'
              }`}
              accessibilityRole="button"
              accessibilityLabel="Select right hand"
              hitSlop={20}
            >
              <Text
                className={`text-sm font-semibold ${
                  selectedHand === 'R' ? 'text-on-primary' : 'text-on-surface-variant'
                }`}
              >
                Right Hand
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedHand('L')}
              className={`flex-1 py-2 rounded-full items-center ${
                selectedHand === 'L' ? 'bg-primary' : 'bg-transparent'
              }`}
              accessibilityRole="button"
              accessibilityLabel="Select left hand"
              hitSlop={20}
            >
              <Text
                className={`text-sm font-semibold ${
                  selectedHand === 'L' ? 'text-on-primary' : 'text-on-surface-variant'
                }`}
              >
                Left Hand
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Instruction */}
        <View className="items-center mt-10">
          <Text className="text-2xl font-bold text-on-surface">
            Finger Tapping Task
          </Text>
          <Text className="mt-3 text-center text-lg leading-8 text-on-surface-variant px-3">
            Tap the circles <Text className="font-bold text-primary">as fast as you can</Text> using two
            fingers.
          </Text>
        </View>

        {/* Tap Targets */}
        <View className="flex-1 items-center justify-center">
          <View className="flex-row items-start" style={{ gap: 40 }}>
            {(['L', 'R'] as const).map((side) => {
              const highlighted = activeSide === side;
              return (
                <View key={side} className="items-center" style={{ gap: 16 }}>
                  <Pressable
                    disabled={isDisabled}
                    onPressIn={() => handleTapIn(side)}
                    onPressOut={() => setActiveSide((current) => (current === side ? null : current))}
                    hitSlop={20}
                    accessibilityRole="button"
                    accessibilityLabel={side === 'L' ? 'Left finger target' : 'Right finger target'}
                    className="w-[120px] h-[120px] rounded-full items-center justify-center border-[4px]"
                    style={{
                      backgroundColor: highlighted ? '#72d9fd' : '#dbe4e9',
                      borderColor: 'rgba(0,104,128,0.10)',
                      transform: [{ scale: highlighted ? 0.92 : 1 }],
                      shadowColor: '#2b3438',
                      shadowOpacity: 0.08,
                      shadowRadius: 10,
                      elevation: 4,
                    }}
                  >
                    <Text className="text-4xl font-extrabold text-primary">{side}</Text>
                  </Pressable>

                  <Text className="text-base font-medium text-on-surface-variant">
                    {side === 'L' ? 'Left Finger' : 'Right Finger'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer Guidance */}
        <View
          className="rounded-xl px-4 py-4 flex-row items-center"
          style={{ gap: 12, backgroundColor: 'rgba(101, 253, 230, 0.20)', borderWidth: 1, borderColor: 'rgba(0, 107, 96, 0.10)' }}
        >
          <View className="w-8 h-8 rounded-lg bg-tertiary items-center justify-center">
            <Ionicons name="information-circle" size={16} color="#e2fff8" />
          </View>
          <Text className="flex-1 text-sm font-medium text-on-tertiary-container">
            Keep your wrist rested on a flat surface for accuracy.
          </Text>
        </View>

        {status === 'saving' ? (
          <View className="items-center mt-4">
            <Text className="text-sm text-primary">Saving result...</Text>
          </View>
        ) : null}
        {status === 'error' ? (
          <View className="items-center mt-4">
            <Text className="text-xs text-error text-center">
              {saveError ?? 'Could not save result.'}
            </Text>
            <Pressable
              className="mt-2 px-4 py-2 rounded-full bg-primary"
              onPress={() => void persistObservation()}
              accessibilityRole="button"
              accessibilityLabel="Retry saving result"
              hitSlop={20}
            >
              <Text className="text-on-primary font-semibold">Retry Save</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Bottom Navigation Replica */}
        <View
          className="mt-6 rounded-t-[40px] px-4 py-3 flex-row justify-around"
          style={{
            backgroundColor: 'rgba(255,255,255,0.8)',
            shadowColor: '#2b3438',
            shadowOpacity: 0.05,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <View className="items-center px-4 py-2 rounded-full bg-surface-container-low">
            <Ionicons name="hand-left-outline" size={18} color="#006880" />
            <Text className="text-[11px] font-medium text-primary mt-0.5">Assess</Text>
          </View>
          <View className="items-center px-4 py-2">
            <Ionicons name="analytics-outline" size={18} color="#aab3b8" />
            <Text className="text-[11px] font-medium text-outline-variant mt-0.5">Trends</Text>
          </View>
          <View className="items-center px-4 py-2">
            <Ionicons name="time-outline" size={18} color="#aab3b8" />
            <Text className="text-[11px] font-medium text-outline-variant mt-0.5">History</Text>
          </View>
          <View className="items-center px-4 py-2">
            <Ionicons name="person-outline" size={18} color="#aab3b8" />
            <Text className="text-[11px] font-medium text-outline-variant mt-0.5">Profile</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

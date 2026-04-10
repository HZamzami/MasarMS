import { useEffect, useRef, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { saveTestResult } from '../../lib/saveTestResult';
import { CountdownOverlay } from '../../lib/CountdownOverlay';
import { useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import type { EsdmtData } from '../../lib/types';

// ─── Icon set (9 unique MaterialCommunityIcons) ────────────────────────────
const ICON_NAMES = [
  'triangle-outline',
  'hexagon-outline',
  'circle-double',
  'grid',
  'star-outline',
  'infinity',
  'diamond-outline',
  'octagon-outline',
  'rhombus-outline',
] as const;

type IconName = (typeof ICON_NAMES)[number];
type KeyEntry = { icon: IconName; number: number };

function generateKey(): KeyEntry[] {
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return ICON_NAMES.map((icon, i) => ({ icon, number: nums[i] }));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function EsdmtScreen() {
  const router = useRouter();
  const { backIcon, formatMessage, formatNumber, messages } = useLocalization();

  const key = useRef<KeyEntry[]>(generateKey()).current;
  const [currentIdx, setCurrentIdx] = useState(() => Math.floor(Math.random() * 9));
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [timeLeft, setTimeLeft] = useState(90);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [done, setDone] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const attemptsRef = useRef(0);
  const correctRef = useRef(0);
  const timeLeftRef = useRef(90);

  useEffect(() => {
    if (done || isCountingDown) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        const next = t <= 1 ? 0 : t - 1;
        timeLeftRef.current = next;
        if (t <= 1) {
          clearInterval(id);
          setDone(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [done, isCountingDown]);

  useEffect(() => {
    if (!done) return;
    void saveObservation();
    router.replace({
      pathname: '/tests/results',
      params: { attempts: String(attemptsRef.current), correct: String(correctRef.current) },
    });
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveObservation() {
    const totalAttempts = attemptsRef.current;
    const correctMatches = correctRef.current;
    const durationSeconds = 90 - timeLeftRef.current;

    await saveTestResult({
      domain: 'cognitive',
      testType: 'eSDMT',
      data: {
        ips_score: correctMatches,
        total_attempts: totalAttempts,
        correct_matches: correctMatches,
        errors: totalAttempts - correctMatches,
        score_pct:
          totalAttempts > 0
            ? Math.round((correctMatches / totalAttempts) * 10000) / 100
            : 0,
        duration_seconds: durationSeconds,
        test_version: '1.0',
      } satisfies EsdmtData,
    });
  }

  function handlePress(tappedNumber: number) {
    if (done || isCountingDown) return;
    const isCorrect = tappedNumber === key[currentIdx].number;
    setAttempts((a) => { attemptsRef.current = a + 1; return a + 1; });
    if (isCorrect) setCorrect((c) => { correctRef.current = c + 1; return c + 1; });
    setFeedback(isCorrect ? 'correct' : 'wrong');

    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      setCurrentIdx(Math.floor(Math.random() * 9));
    }, 300);

    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const challengeBorderColor =
    feedback === 'correct'
      ? '#006880'
      : feedback === 'wrong'
        ? '#a83836'
        : '#cdd5da';

  const challengeGlowColor =
    feedback === 'correct'
      ? '#006880'
      : feedback === 'wrong'
        ? '#a83836'
        : '#000';

  // Split 9 icons into 3 rows of 3 for the reference key
  const keyRows = [key.slice(0, 3), key.slice(3, 6), key.slice(6, 9)];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />

      {isCountingDown && (
        <CountdownOverlay onFinished={() => setIsCountingDown(false)} />
      )}

      {/* Top bar */}
      <View className="flex-row justify-between items-center px-5 pt-2 pb-3">
        <TouchableOpacity onPress={() => router.back()} hitSlop={20}>
          <Ionicons name={backIcon} size={24} color="#006880" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-on-surface">{messages.common.appName}</Text>
        <View className="w-8 h-8" />
      </View>

      {/* Timer + score row */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <View
          className="flex-row items-center gap-2 bg-surface-container-lowest rounded-2xl px-5 py-2.5"
          style={{ borderWidth: 1, borderColor: '#cdd5da' }}
        >
          <Ionicons name="time-outline" size={18} color="#006880" />
          <Text className="text-2xl font-bold text-primary tabular-nums">
            {formatTime(timeLeft)}
          </Text>
        </View>

        <View
          className="flex-row items-center gap-2 bg-surface-container-lowest rounded-2xl px-5 py-2.5"
          style={{ borderWidth: 1, borderColor: '#cdd5da' }}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#006880" />
          <Text className="text-2xl font-bold text-primary tabular-nums">
            {formatNumber(correct)}
            <Text className="text-base font-medium text-on-surface-variant">
              /{formatNumber(attempts)}
            </Text>
          </Text>
        </View>
      </View>

      {/* Reference key – 3×3 grid */}
      <View
        className="mx-5 mb-4 bg-surface-container-low rounded-2xl p-4"
        style={{ borderWidth: 1, borderColor: '#cdd5da' }}
      >
        <Text className="text-[10px] font-bold text-on-surface-variant text-center mb-3 uppercase tracking-widest">
          {messages.esdmt.referenceKey}
        </Text>
        {keyRows.map((row, rowIdx) => (
          <View
            key={rowIdx}
            className="flex-row justify-around"
            style={rowIdx < 2 ? { marginBottom: 10 } : undefined}
          >
            {row.map(({ icon, number }) => (
              <View
                key={icon}
                className="items-center bg-surface-container-lowest rounded-xl"
                style={{
                  width: '30%',
                  paddingVertical: 8,
                  gap: 4,
                  borderWidth: 1,
                  borderColor: '#e4ebee',
                }}
              >
                <MaterialCommunityIcons name={icon} size={26} color="#006880" />
                <Text className="text-sm font-bold text-on-surface">{number}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Challenge symbol */}
      <View className="flex-1 items-center justify-center">
        <Text className="text-xs font-semibold text-on-surface-variant mb-4 uppercase tracking-widest">
          {messages.esdmt.selectPrompt}
        </Text>
        <View
          style={{
            width: 140,
            height: 140,
            borderRadius: 28,
            backgroundColor: '#f0f4f5',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2.5,
            borderColor: challengeBorderColor,
            shadowColor: challengeGlowColor,
            shadowOpacity: feedback ? 0.25 : 0.08,
            shadowRadius: feedback ? 16 : 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: feedback ? 10 : 4,
          }}
        >
          <MaterialCommunityIcons
            name={key[currentIdx].icon}
            size={72}
            color="#006880"
          />
        </View>
      </View>

      {/* 3×3 keypad */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 10 }}>
        {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row', gap: 10 }}>
            {row.map((n) => (
              <TouchableOpacity
                key={n}
                style={{
                  flex: 1,
                  height: 72,
                  backgroundColor: '#dbe4e9',
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#c5d0d5',
                }}
                onPress={() => handlePress(n)}
                activeOpacity={0.7}
                accessibilityLabel={formatMessage(messages.esdmt.numberA11y, { number: formatNumber(n) })}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 26, fontWeight: '700', color: '#006880' }}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

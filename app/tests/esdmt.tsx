import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';

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
  // Fisher-Yates shuffle
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

  const key = useRef<KeyEntry[]>(generateKey()).current;
  const [currentIdx, setCurrentIdx] = useState(() => Math.floor(Math.random() * 9));
  const [timeLeft, setTimeLeft] = useState(90);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [done, setDone] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          setDone(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [done]);

  // ── Finish: save + navigate ───────────────────────────────────────────────
  useEffect(() => {
    if (!done) return;
    saveObservation();
    router.replace({
      pathname: '/tests/results',
      params: { attempts: String(attempts), correct: String(correct) },
    });
  }, [done]);

  async function saveObservation() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('observations').insert({
      user_id: user.id,
      test_type: 'esdmt',
      test_version: '1.0',
      total_attempts: attempts,
      correct_matches: correct,
      duration_seconds: 90 - timeLeft,
      device_platform: Platform.OS,
    });
  }

  // ── Button press ─────────────────────────────────────────────────────────
  function handlePress(tappedNumber: number) {
    if (done) return;
    const isCorrect = tappedNumber === key[currentIdx].number;
    setAttempts((a) => a + 1);
    if (isCorrect) setCorrect((c) => c + 1);
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

  // ── Border color for challenge card ──────────────────────────────────────
  const challengeBorderColor =
    feedback === 'correct'
      ? '#006880'
      : feedback === 'wrong'
        ? '#a83836'
        : '#aab3b8';

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Top bar */}
      <View className="flex-row justify-between items-center px-6 py-4">
        <TouchableOpacity onPress={() => router.back()} hitSlop={20}>
          <Ionicons name="arrow-back" size={24} color="#006880" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-on-surface">MasarMS</Text>
        <View className="w-8 h-8" />
      </View>

      {/* Timer */}
      <View className="items-center mb-8">
        <View className="bg-surface-container-lowest border border-outline-variant rounded-full px-8 py-3 shadow-sm">
          <Text className="text-4xl font-bold text-primary">
            {formatTime(timeLeft)}
          </Text>
        </View>
        <Text className="text-xs font-semibold text-on-surface-variant mt-2 tracking-widest uppercase">
          Remaining Time
        </Text>
      </View>

      {/* Reference key – 9 columns */}
      <View className="mx-4 mb-8 bg-surface-container-low rounded-xl p-2 border border-outline-variant">
        <Text className="text-xs font-bold text-on-surface-variant text-center mb-2 uppercase tracking-wider">
          Reference Key
        </Text>
        <View className="flex-row justify-around">
          {key.map(({ icon, number }) => (
            <View key={icon} className="items-center" style={{ gap: 2 }}>
              <MaterialCommunityIcons name={icon} size={22} color="#006880" />
              <Text className="text-xs font-bold text-on-surface">{number}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Challenge symbol */}
      <View className="flex-1 items-center justify-center mb-8">
        <View
          className="w-40 h-40 bg-surface-container-lowest rounded-3xl items-center justify-center"
          style={{
            borderColor: challengeBorderColor,
            borderWidth: 2,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <MaterialCommunityIcons
            name={key[currentIdx].icon}
            size={72}
            color="#006880"
          />
        </View>
        <Text className="mt-6 text-on-surface-variant text-sm">
          Select the corresponding number below
        </Text>
        <Text className="mt-2 text-xs text-on-surface-variant">
          {correct}/{attempts} correct
        </Text>
      </View>

      {/* 3×3 keypad */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: 16,
          paddingBottom: 24,
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <TouchableOpacity
            key={n}
            style={{
              width: '30%',
              margin: '1.5%',
              height: 80,
              backgroundColor: '#dbe4e9',
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => handlePress(n)}
            hitSlop={16}
            accessibilityLabel={`Number ${n}`}
            accessibilityRole="button"
          >
            <Text className="text-2xl font-bold text-primary">{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

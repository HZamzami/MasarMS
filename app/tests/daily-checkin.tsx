import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { getLocalizedErrorMessage, useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import { supabase } from '../../lib/supabase';
import { saveTestResult } from '../../lib/saveTestResult';
import type { DailyEMAData } from '../../lib/types';

const MOODS = [
  { emoji: '😫', value: 0 },
  { emoji: '🙁', value: 1 },
  { emoji: '😐', value: 2 },
  { emoji: '🙂', value: 3 },
  { emoji: '🤩', value: 4 },
] as const;

type ScreenState = 'form' | 'saving' | 'done';

function toDateKey(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function computeStreak(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 1;

  const { data: rows } = await supabase
    .from('test_results')
    .select('created_at')
    .eq('user_id', user.id)
    .eq('test_type', 'DailyEMA')
    .order('created_at', { ascending: false })
    .limit(90);

  if (!rows || rows.length === 0) return 1;

  const seen = new Set(rows.map((row) => toDateKey(row.created_at)));
  let streak = 0;
  const today = new Date();
  for (let dayOffset = 0; dayOffset < 90; dayOffset += 1) {
    const target = new Date(today);
    target.setDate(today.getDate() - dayOffset);
    if (!seen.has(toDateKey(target.toISOString()))) break;
    streak += 1;
  }
  return Math.max(streak, 1);
}

function MoodButton({
  emoji,
  label,
  selected,
  onPress,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label.replace('\n', ' ')}
      className={`flex-1 items-center justify-center py-4 rounded-2xl border-2 ${
        selected ? 'bg-secondary-container border-primary' : 'bg-surface-container-low border-transparent'
      }`}
      style={{ minHeight: 80 }}
    >
      <Text style={{ fontSize: 28, marginBottom: 4 }}>{emoji}</Text>
      <Text
        className={`text-center font-bold uppercase tracking-tighter ${
          selected ? 'text-primary' : 'text-on-surface-variant'
        }`}
        style={{ fontSize: 9 }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SuccessCard({
  streak,
  onDismiss,
}: {
  streak: number;
  onDismiss: () => void;
}) {
  const { formatMessage, formatNumber, messages, textAlign } = useLocalization();
  const isFirstDay = streak === 1;

  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-24 h-24 rounded-full bg-tertiary-container items-center justify-center mb-8">
        <Ionicons name="checkmark-circle" size={56} color="#006b60" />
      </View>

      <Text className="text-2xl font-extrabold text-on-surface text-center mb-3" style={textAlign}>
        {messages.dailyCheckin.savedTitle}
      </Text>

      <View className="bg-surface-container rounded-2xl px-6 py-4 items-center mb-6 w-full">
        <Text className="text-2xl font-extrabold text-primary mb-1">
          {isFirstDay
            ? messages.dailyCheckin.firstDayBadge
            : `🔥 ${formatMessage(messages.dailyCheckin.streakBadge, { streak: formatNumber(streak) })}`}
        </Text>
        <Text className="text-sm text-on-surface-variant text-center" style={textAlign}>
          {isFirstDay ? messages.dailyCheckin.firstDayBody : messages.dailyCheckin.streakBody}
        </Text>
      </View>

      <Text className="text-on-surface-variant text-center leading-relaxed mb-12 px-4" style={textAlign}>
        {messages.dailyCheckin.thanksBody}
      </Text>

      <TouchableOpacity
        onPress={onDismiss}
        className="w-full bg-primary rounded-full py-5 items-center"
        accessibilityRole="button"
        accessibilityLabel={messages.common.backToDashboard}
      >
        <Text className="text-on-primary font-bold text-lg">{messages.common.backToDashboard}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DailyCheckin() {
  const router = useRouter();
  const {
    backIcon,
    formatDate,
    messages,
    row,
    textAlign,
  } = useLocalization();

  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState(5);
  const [notes, setNotes] = useState('');
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [streak, setStreak] = useState(1);
  const [moodError, setMoodError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit() {
    if (mood === null) {
      setMoodError(true);
      return;
    }

    setMoodError(false);
    setSaveError(null);
    setScreenState('saving');

    try {
      const capturedAt = new Date().toISOString();

      await saveTestResult({
        domain: 'mood',
        testType: 'DailyEMA',
        data: {
          mood_index: mood,
          mood_normalized: mood / 4,
          energy_level: energy,
          energy_normalized: (energy - 1) / 9,
          notes: notes.trim() || null,
          captured_at: capturedAt,
          frequency: 'daily',
          test_version: '1.0',
        } satisfies DailyEMAData,
      });

      const computedStreak = await computeStreak();
      setStreak(computedStreak);
      setScreenState('done');
    } catch (error) {
      const message = getLocalizedErrorMessage(error, messages, messages.common.saveFailed);
      setSaveError(message);
      setScreenState('form');
    }
  }

  const isSaving = screenState === 'saving';

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View
          className="items-center justify-between px-6 py-4"
          style={[row, { borderBottomWidth: 1, borderBottomColor: 'rgba(170,179,184,0.3)' }]}
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
            <Text className="font-bold text-lg text-on-surface" style={{ marginStart: 16 }}>
              {messages.dailyCheckin.title}
            </Text>
          </View>
          <Text className="text-xs text-on-surface-variant font-medium" style={textAlign}>
            {formatDate(new Date(), { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>

        {screenState === 'done' ? (
          <SuccessCard streak={streak} onDismiss={() => router.replace('/')} />
        ) : (
          <>
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="mb-10">
                <Text className="text-2xl font-extrabold text-primary leading-tight" style={textAlign}>
                  {messages.dailyCheckin.prompt}
                </Text>
              </View>

              <View className="mb-10">
                <View className="items-center justify-between mb-4" style={row}>
                  <Text className="font-bold text-base text-on-surface" style={textAlign}>
                    {messages.dailyCheckin.moodTitle}
                  </Text>
                  <Text className="text-sm text-on-surface-variant" style={textAlign}>
                    {messages.common.required}
                  </Text>
                </View>
                {moodError ? (
                  <Text className="text-error text-sm mb-3" style={textAlign}>
                    {messages.dailyCheckin.moodRequiredError}
                  </Text>
                ) : null}
                <View className="flex-row" style={{ gap: 8 }}>
                  {MOODS.map((item, index) => (
                    <MoodButton
                      key={item.value}
                      emoji={item.emoji}
                      label={messages.dailyCheckin.moods[index]}
                      selected={mood === item.value}
                      onPress={() => {
                        setMood(item.value);
                        setMoodError(false);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View className="bg-surface-container-low rounded-3xl p-6 mb-10">
                <View className="items-center mb-6" style={row}>
                  <View className="w-12 h-12 rounded-full bg-primary-container items-center justify-center">
                    <Ionicons name="flash" size={22} color="#004a5d" />
                  </View>
                  <View className="flex-1" style={{ marginStart: 12 }}>
                    <Text className="font-bold text-base text-on-surface" style={textAlign}>
                      {messages.dailyCheckin.energyTitle}
                    </Text>
                    <Text className="text-sm text-on-surface-variant" style={textAlign}>
                      {messages.dailyCheckin.energySubtitle}
                    </Text>
                  </View>
                  <View className="bg-primary rounded-full w-10 h-10 items-center justify-center">
                    <Text className="text-on-primary font-extrabold text-base">{energy}</Text>
                  </View>
                </View>

                <Slider
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  value={energy}
                  onValueChange={setEnergy}
                  minimumTrackTintColor="#006880"
                  maximumTrackTintColor="#dbe4e9"
                  thumbTintColor="#006880"
                  accessibilityLabel={messages.dailyCheckin.energyTitle}
                  accessibilityValue={{ min: 1, max: 10, now: energy }}
                  style={{ marginHorizontal: -4 }}
                />

                <View className="justify-between mt-1 px-1" style={row}>
                  <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-wide" style={textAlign}>
                    {messages.dailyCheckin.exhausted}
                  </Text>
                  <Text className="text-xs font-bold text-primary uppercase tracking-wide" style={textAlign}>
                    {messages.dailyCheckin.energized}
                  </Text>
                </View>
              </View>

              <View className="mb-6">
                <View className="items-center mb-3" style={row}>
                  <Ionicons name="create-outline" size={22} color="#006880" style={{ marginEnd: 8 }} />
                  <Text className="font-bold text-base text-on-surface flex-1" style={textAlign}>
                    {messages.dailyCheckin.symptomsTitle}
                  </Text>
                </View>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={messages.dailyCheckin.symptomsPlaceholder}
                  placeholderTextColor="#737c80"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="bg-surface-container-highest rounded-2xl p-5 text-on-surface"
                  style={{ minHeight: 100, textAlign: Platform.OS === 'web' ? undefined : textAlign.textAlign, writingDirection: row.flexDirection === 'row-reverse' ? 'rtl' : 'ltr' }}
                  accessibilityLabel={messages.dailyCheckin.symptomsA11y}
                />
              </View>

              {saveError ? (
                <Text className="text-error text-sm text-center mb-4" style={textAlign}>{saveError}</Text>
              ) : null}
            </ScrollView>

            <View
              className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4 bg-surface"
              style={{ borderTopWidth: 1, borderTopColor: 'rgba(170,179,184,0.2)' }}
            >
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSaving}
                className="w-full bg-primary rounded-full py-5 items-center justify-center"
                style={[row, { gap: 10, opacity: isSaving ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={messages.dailyCheckin.saveA11y}
                accessibilityState={{ disabled: isSaving }}
              >
                {isSaving ? (
                  <ActivityIndicator color="#f1faff" />
                ) : (
                  <>
                    <Text className="text-on-primary font-bold text-lg">{messages.dailyCheckin.saveCta}</Text>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#f1faff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

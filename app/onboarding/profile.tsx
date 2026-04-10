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
import { useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/types';

type MsPhenotype = NonNullable<Profile['ms_phenotype']>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TOTAL_STEPS = 3;

const PHENOTYPES: { key: MsPhenotype; icon: IoniconName }[] = [
  { key: 'RRMS', icon: 'refresh-circle-outline' },
  { key: 'SPMS', icon: 'trending-up-outline' },
  { key: 'PPMS', icon: 'stats-chart-outline' },
];

const EDUCATION_LEVELS: { key: string; icon: IoniconName }[] = [
  { key: 'primary', icon: 'school-outline' },
  { key: 'high_school', icon: 'ribbon-outline' },
  { key: 'vocational', icon: 'hammer-outline' },
  { key: 'bachelor', icon: 'library-outline' },
  { key: 'graduate_plus', icon: 'trophy-outline' },
];

function PhenotypeCard({
  item,
  index,
  selected,
  onPress,
}: {
  item: (typeof PHENOTYPES)[number];
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { messages, row, textAlign } = useLocalization();
  const copy = messages.onboarding.phenotype.cards[index];

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={copy.label}
      className={`items-center p-4 rounded-2xl border-2 ${
        selected ? 'bg-surface-container-lowest border-primary' : 'bg-surface-container border-transparent'
      }`}
      style={[
        row,
        { gap: 16 },
        selected
          ? {
            shadowColor: '#006880',
            shadowOpacity: 0.12,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }
          : undefined,
      ]}
    >
      <View
        className={`w-11 h-11 rounded-full items-center justify-center ${
          selected ? 'bg-primary' : 'bg-surface-container-highest'
        }`}
      >
        <Ionicons name={item.icon} size={22} color={selected ? '#f1faff' : '#576065'} />
      </View>
      <View className="flex-1">
        <View className="items-center" style={[row, { gap: 8 }]}>
          <Text className="font-bold text-sm text-on-surface flex-1" style={textAlign}>
            {copy.label}
          </Text>
          <View className="bg-surface-container px-2 py-0.5 rounded-full">
            <Text className="text-xs font-bold text-on-surface-variant">{copy.shortLabel}</Text>
          </View>
        </View>
        <Text className="text-xs text-on-surface-variant mt-1 leading-5" style={textAlign}>
          {copy.subtitle}
        </Text>
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color="#006880" />
      ) : null}
    </TouchableOpacity>
  );
}

function EducationCard({
  item,
  index,
  selected,
  onPress,
}: {
  item: (typeof EDUCATION_LEVELS)[number];
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { messages, row, textAlign } = useLocalization();

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={messages.onboarding.education.levels[index]}
      className={`items-center px-4 py-3.5 rounded-2xl border-2 ${
        selected ? 'bg-surface-container-lowest border-primary' : 'bg-surface-container border-transparent'
      }`}
      style={[row, { gap: 12 }]}
    >
      <View
        className={`w-9 h-9 rounded-full items-center justify-center ${
          selected ? 'bg-primary' : 'bg-surface-container-highest'
        }`}
      >
        <Ionicons name={item.icon} size={18} color={selected ? '#f1faff' : '#576065'} />
      </View>
      <Text className={`flex-1 text-sm font-semibold ${selected ? 'text-primary' : 'text-on-surface'}`} style={textAlign}>
        {messages.onboarding.education.levels[index]}
      </Text>
      {selected ? <Ionicons name="checkmark-circle" size={20} color="#006880" /> : null}
    </TouchableOpacity>
  );
}

function InputField({
  label,
  icon,
  optional,
  hint,
  error,
  ...inputProps
}: {
  label: string;
  icon: IoniconName;
  optional?: boolean;
  hint?: string;
  error?: string;
} & React.ComponentProps<typeof TextInput>) {
  const { inputAlign, messages, row, textAlign } = useLocalization();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <View className="items-center justify-between mb-2 ms-1" style={row}>
        <Text className="text-sm font-semibold text-on-surface-variant" style={textAlign}>
          {label}
        </Text>
        {optional ? (
          <View className="bg-surface-container px-2 py-0.5 rounded-full">
            <Text className="text-xs font-semibold text-on-surface-variant">{messages.common.optional}</Text>
          </View>
        ) : null}
      </View>
      <View
        className={`items-center bg-surface-container-highest rounded-xl px-4 py-3 border-2 ${
          error ? 'border-error' : focused ? 'border-primary' : 'border-transparent'
        }`}
        style={[row, { gap: 12 }]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={error ? '#a83836' : '#737c80'}
        />
        <TextInput
          className="flex-1 text-on-surface font-semibold text-base"
          style={inputAlign}
          placeholderTextColor="#aab3b8"
          keyboardType="numeric"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text className="mt-1.5 ms-1 text-xs text-error" style={textAlign}>{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 ms-1 text-xs text-on-surface-variant leading-5" style={textAlign}>{hint}</Text>
      ) : null}
    </View>
  );
}

export default function ProfileSetup() {
  const router = useRouter();
  const { backIcon, formatMessage, messages, forwardIcon, row, textAlign } = useLocalization();

  const [step, setStep] = useState(1);
  const [phenotype, setPhenotype] = useState<MsPhenotype | null>(null);
  const [education, setEducation] = useState<string | null>(null);
  const [yearsDx, setYearsDx] = useState('');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [edss, setEdss] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateStep1(): boolean {
    if (!phenotype) {
      setErrors({ phenotype: messages.onboarding.phenotype.error });
      return false;
    }
    setErrors({});
    return true;
  }

  function validateStep2(): boolean {
    if (!education) {
      setErrors({ education: messages.onboarding.education.error });
      return false;
    }
    setErrors({});
    return true;
  }

  function validateStep3(): boolean {
    const next: Record<string, string> = {};

    const yrs = parseInt(yearsDx, 10);
    if (!yearsDx || Number.isNaN(yrs) || yrs < 0) next.yearsDx = messages.onboarding.errors.yearsSinceDiagnosis;

    const ageValue = parseInt(age, 10);
    if (!age || Number.isNaN(ageValue) || ageValue < 18 || ageValue > 65) next.age = messages.onboarding.errors.age;

    const heightValue = parseInt(heightCm, 10);
    if (!heightCm || Number.isNaN(heightValue) || heightValue < 50 || heightValue > 300) {
      next.heightCm = messages.onboarding.errors.height;
    }

    const weightValue = parseFloat(weightKg);
    if (!weightKg || Number.isNaN(weightValue) || weightValue < 20 || weightValue > 500) {
      next.weightKg = messages.onboarding.errors.weight;
    }

    if (edss) {
      const edssValue = parseFloat(edss);
      if (Number.isNaN(edssValue) || edssValue < 0 || edssValue > 5.5) {
        next.edss = messages.onboarding.errors.edss;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNext() {
    if (step === 1) {
      if (validateStep1()) setStep(2);
      return;
    }
    if (step === 2) {
      if (validateStep2()) setStep(3);
      return;
    }
    void handleSubmit();
  }

  async function handleSubmit() {
    if (!validateStep3()) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrors({ _global: messages.onboarding.errors.sessionExpired });
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        ms_phenotype: phenotype,
        years_since_diagnosis: parseInt(yearsDx, 10),
        age: parseInt(age, 10),
        height_cm: parseInt(heightCm, 10),
        weight_kg: parseFloat(weightKg),
        edss_score: edss ? parseFloat(edss) : null,
        education_level: education,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      setErrors({ _global: messages.common.saveFailed });
      return;
    }

    router.replace('/');
  }

  const progressPct = (step / TOTAL_STEPS) * 100;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="px-6 pt-5 pb-4">
          <View className="items-center justify-between mb-3" style={row}>
            {step > 1 ? (
              <TouchableOpacity
                onPress={() => {
                  setStep(step - 1);
                  setErrors({});
                }}
                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                accessibilityRole="button"
                accessibilityLabel={formatMessage(messages.onboarding.backToStep, { step: step - 1 })}
              >
                <Ionicons name={backIcon} size={22} color="#006880" />
              </TouchableOpacity>
            ) : (
              <View className="w-6" />
            )}

            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest" style={textAlign}>
              {formatMessage(messages.onboarding.progress, { step, total: TOTAL_STEPS })}
            </Text>

            <View className="w-6" />
          </View>

          <View className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <View className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <>
              <Text className="text-2xl font-extrabold text-on-surface mb-2" style={textAlign}>
                {messages.onboarding.phenotype.title}
              </Text>
              <Text className="text-on-surface-variant leading-relaxed mb-8 text-sm" style={textAlign}>
                {messages.onboarding.phenotype.subtitle}
              </Text>

              {errors.phenotype ? (
                <Text className="text-error text-sm mb-4" style={textAlign}>{errors.phenotype}</Text>
              ) : null}

              <View style={{ gap: 10 }}>
                {PHENOTYPES.map((item, index) => (
                  <PhenotypeCard
                    key={item.key}
                    item={item}
                    index={index}
                    selected={phenotype === item.key}
                    onPress={() => {
                      setPhenotype(item.key);
                      setErrors({});
                    }}
                  />
                ))}
              </View>

              <View className="mt-6 p-4 bg-surface-container rounded-2xl items-start" style={[row, { gap: 12 }]}>
                <Ionicons name="information-circle-outline" size={20} color="#506076" />
                <Text className="flex-1 text-xs text-on-surface-variant leading-5" style={textAlign}>
                  {messages.onboarding.phenotype.help}
                </Text>
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text className="text-2xl font-extrabold text-on-surface mb-2" style={textAlign}>
                {messages.onboarding.education.title}
              </Text>
              <Text className="text-on-surface-variant leading-relaxed mb-8 text-sm" style={textAlign}>
                {messages.onboarding.education.subtitle}
              </Text>

              {errors.education ? (
                <Text className="text-error text-sm mb-4" style={textAlign}>{errors.education}</Text>
              ) : null}

              <View style={{ gap: 8 }}>
                {EDUCATION_LEVELS.map((item, index) => (
                  <EducationCard
                    key={item.key}
                    item={item}
                    index={index}
                    selected={education === item.key}
                    onPress={() => {
                      setEducation(item.key);
                      setErrors({});
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text className="text-2xl font-extrabold text-on-surface mb-2" style={textAlign}>
                {messages.onboarding.details.title}
              </Text>
              <Text className="text-on-surface-variant leading-relaxed mb-8 text-sm" style={textAlign}>
                {messages.onboarding.details.subtitle}
              </Text>

              <View style={{ gap: 20 }}>
                <InputField
                  label={messages.onboarding.fields.age}
                  icon="person-outline"
                  placeholder={messages.onboarding.placeholders.age}
                  value={age}
                  onChangeText={setAge}
                  error={errors.age}
                />

                <View style={[row, { gap: 12 }]}>
                  <View className="flex-1">
                    <InputField
                      label={messages.onboarding.fields.height}
                      icon="resize-outline"
                      placeholder={messages.onboarding.placeholders.height}
                      value={heightCm}
                      onChangeText={setHeightCm}
                      error={errors.heightCm}
                    />
                  </View>
                  <View className="flex-1">
                    <InputField
                      label={messages.onboarding.fields.weight}
                      icon="scale-outline"
                      placeholder={messages.onboarding.placeholders.weight}
                      value={weightKg}
                      onChangeText={setWeightKg}
                      error={errors.weightKg}
                    />
                  </View>
                </View>

                <InputField
                  label={messages.onboarding.fields.yearsSinceDiagnosis}
                  icon="calendar-outline"
                  placeholder={messages.onboarding.placeholders.yearsSinceDiagnosis}
                  value={yearsDx}
                  onChangeText={setYearsDx}
                  error={errors.yearsDx}
                  hint={messages.onboarding.hints.yearsSinceDiagnosis}
                />

                <InputField
                  label={messages.onboarding.fields.edssScore}
                  icon="analytics-outline"
                  optional
                  placeholder={messages.onboarding.placeholders.edss}
                  value={edss}
                  onChangeText={setEdss}
                  error={errors.edss}
                  hint={messages.onboarding.hints.edss}
                />
              </View>

              {errors._global ? (
                <Text className="text-error text-sm text-center mt-6" style={textAlign}>{errors._global}</Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4 bg-surface"
          style={{ borderTopWidth: 1, borderTopColor: 'rgba(170,179,184,0.2)' }}
        >
          <TouchableOpacity
            onPress={handleNext}
            disabled={loading}
            className="w-full bg-primary rounded-full py-5 items-center justify-center"
            style={[row, { gap: 10, opacity: loading ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={step < TOTAL_STEPS ? messages.onboarding.nextStep : messages.onboarding.completeSetupA11y}
          >
            {loading ? (
              <ActivityIndicator color="#f1faff" />
            ) : (
              <>
                <Text className="text-on-primary font-bold text-lg">
                  {step < TOTAL_STEPS ? messages.common.continue : messages.onboarding.completeSetup}
                </Text>
                {step < TOTAL_STEPS ? (
                  <Ionicons name={forwardIcon} size={20} color="#f1faff" />
                ) : null}
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

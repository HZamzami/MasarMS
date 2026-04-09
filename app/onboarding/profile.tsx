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
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/types';

type MsPhenotype = NonNullable<Profile['ms_phenotype']>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TOTAL_STEPS = 3;

// ─── Phenotype config (PRMS removed — not in current ICD classification) ──────

const PHENOTYPES: Array<{
  key: MsPhenotype;
  label: string;
  shortLabel: string;
  subtitle: string;
  icon: IoniconName;
}> = [
  {
    key: 'RRMS',
    label: 'Relapsing-Remitting MS',
    shortLabel: 'RRMS',
    subtitle: 'Most common form — relapses followed by recovery periods.',
    icon: 'refresh-circle-outline',
  },
  {
    key: 'SPMS',
    label: 'Secondary Progressive MS',
    shortLabel: 'SPMS',
    subtitle: 'Steady progression following an initial relapsing-remitting course.',
    icon: 'trending-up-outline',
  },
  {
    key: 'PPMS',
    label: 'Primary Progressive MS',
    shortLabel: 'PPMS',
    subtitle: 'Gradual worsening of neurological function from onset.',
    icon: 'stats-chart-outline',
  },
];

// ─── Education level config ────────────────────────────────────────────────────
// Education level is a key covariate for cognitive baseline interpretation —
// higher education correlates with better eSDMT performance independent of MS.

const EDUCATION_LEVELS: Array<{ key: string; label: string; icon: IoniconName }> = [
  { key: 'less_than_high_school', label: 'Less than high school',  icon: 'school-outline'    },
  { key: 'high_school',           label: 'High school / GED',      icon: 'ribbon-outline'     },
  { key: 'some_college',          label: 'Some college',           icon: 'book-outline'       },
  { key: 'bachelor',              label: "Bachelor's degree",      icon: 'library-outline'    },
  { key: 'graduate',              label: 'Graduate degree',        icon: 'trophy-outline'     },
];

// ─── PhenotypeCard ────────────────────────────────────────────────────────────

function PhenotypeCard({
  item,
  selected,
  onPress,
}: {
  item: (typeof PHENOTYPES)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={item.label}
      className={`flex-row items-center p-4 rounded-2xl border-2 ${
        selected
          ? 'bg-surface-container-lowest border-primary'
          : 'bg-surface-container border-transparent'
      }`}
      style={
        selected
          ? {
              shadowColor: '#006880',
              shadowOpacity: 0.12,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            }
          : undefined
      }
    >
      <View
        className={`w-11 h-11 rounded-full items-center justify-center mr-4 ${
          selected ? 'bg-primary' : 'bg-surface-container-highest'
        }`}
      >
        <Ionicons name={item.icon} size={22} color={selected ? '#f1faff' : '#576065'} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text className="font-bold text-sm text-on-surface">{item.label}</Text>
          <View className="bg-surface-container px-2 py-0.5 rounded-full">
            <Text className="text-xs font-bold text-on-surface-variant">{item.shortLabel}</Text>
          </View>
        </View>
        <Text className="text-xs text-on-surface-variant mt-1 leading-5">{item.subtitle}</Text>
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={22} color="#006880" style={{ marginLeft: 8 }} />
      )}
    </TouchableOpacity>
  );
}

// ─── EducationCard ────────────────────────────────────────────────────────────

function EducationCard({
  item,
  selected,
  onPress,
}: {
  item: (typeof EDUCATION_LEVELS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={item.label}
      className={`flex-row items-center px-4 py-3.5 rounded-2xl border-2 ${
        selected
          ? 'bg-surface-container-lowest border-primary'
          : 'bg-surface-container border-transparent'
      }`}
    >
      <View
        className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
          selected ? 'bg-primary' : 'bg-surface-container-highest'
        }`}
      >
        <Ionicons name={item.icon} size={18} color={selected ? '#f1faff' : '#576065'} />
      </View>
      <Text
        className={`flex-1 text-sm font-semibold ${
          selected ? 'text-primary' : 'text-on-surface'
        }`}
      >
        {item.label}
      </Text>
      {selected && <Ionicons name="checkmark-circle" size={20} color="#006880" />}
    </TouchableOpacity>
  );
}

// ─── InputField ───────────────────────────────────────────────────────────────

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
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <View className="flex-row justify-between items-center mb-2 ml-1">
        <Text className="text-sm font-semibold text-on-surface-variant">{label}</Text>
        {optional && (
          <View className="bg-surface-container px-2 py-0.5 rounded-full">
            <Text className="text-xs font-semibold text-on-surface-variant">Optional</Text>
          </View>
        )}
      </View>
      <View
        className={`flex-row items-center bg-surface-container-highest rounded-xl px-4 py-3 border-2 ${
          error ? 'border-error' : focused ? 'border-primary' : 'border-transparent'
        }`}
      >
        <Ionicons
          name={icon}
          size={20}
          color={error ? '#a83836' : '#737c80'}
          style={{ marginRight: 12 }}
        />
        <TextInput
          className="flex-1 text-on-surface font-semibold text-base"
          placeholderTextColor="#aab3b8"
          keyboardType="numeric"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text className="mt-1.5 ml-1 text-xs text-error">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 ml-1 text-xs text-on-surface-variant leading-5">{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── ProfileSetup ─────────────────────────────────────────────────────────────

export default function ProfileSetup() {
  const router = useRouter();

  const [step, setStep] = useState(1);

  // Step 1
  const [phenotype, setPhenotype] = useState<MsPhenotype | null>(null);

  // Step 2
  const [education, setEducation] = useState<string | null>(null);

  // Step 3
  const [yearsDx, setYearsDx] = useState('');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [edss, setEdss] = useState('');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    if (!phenotype) {
      setErrors({ phenotype: 'Please select your MS type to continue.' });
      return false;
    }
    setErrors({});
    return true;
  }

  function validateStep2(): boolean {
    if (!education) {
      setErrors({ education: 'Please select your education level.' });
      return false;
    }
    setErrors({});
    return true;
  }

  function validateStep3(): boolean {
    const next: Record<string, string> = {};

    const yrs = parseInt(yearsDx, 10);
    if (!yearsDx || isNaN(yrs) || yrs < 0) {
      next.yearsDx = 'Enter a valid number of years (0 or more).';
    }

    const ageVal = parseInt(age, 10);
    if (!age || isNaN(ageVal) || ageVal < 18 || ageVal > 65) {
      next.age = 'Age must be between 18 and 65.';
    }

    const heightVal = parseInt(heightCm, 10);
    if (!heightCm || isNaN(heightVal) || heightVal < 100 || heightVal > 250) {
      next.heightCm = 'Enter a valid height in cm (100–250).';
    }

    const weightVal = parseFloat(weightKg);
    if (!weightKg || isNaN(weightVal) || weightVal < 30 || weightVal > 300) {
      next.weightKg = 'Enter a valid weight in kg (30–300).';
    }

    if (edss) {
      const edssVal = parseFloat(edss);
      if (isNaN(edssVal) || edssVal < 0 || edssVal > 10) {
        next.edss = 'EDSS score must be between 0.0 and 10.0.';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function handleNext() {
    if (step === 1) { if (validateStep1()) setStep(2); }
    else if (step === 2) { if (validateStep2()) setStep(3); }
    else { void handleSubmit(); }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validateStep3()) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrors({ _global: 'Session expired. Please sign in again.' });
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        ms_phenotype:          phenotype,
        years_since_diagnosis: parseInt(yearsDx, 10),
        age:                   parseInt(age, 10),
        height_cm:             parseInt(heightCm, 10),
        weight_kg:             parseFloat(weightKg),
        edss_score:            edss ? parseFloat(edss) : null,
        education_level:       education,
        updated_at:            new Date().toISOString(),
      })
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      setErrors({ _global: error.message });
      return;
    }

    router.replace('/');
  }

  // ── Progress bar ───────────────────────────────────────────────────────────
  const progressPct = (step / TOTAL_STEPS) * 100;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View className="px-6 pt-5 pb-4">
          <View className="flex-row items-center justify-between mb-3">
            {step > 1 ? (
              <TouchableOpacity
                onPress={() => { setStep(step - 1); setErrors({}); }}
                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                accessibilityRole="button"
                accessibilityLabel={`Back to step ${step - 1}`}
              >
                <Ionicons name="arrow-back" size={22} color="#006880" />
              </TouchableOpacity>
            ) : (
              <View className="w-6" />
            )}

            <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              Step {step} of {TOTAL_STEPS}
            </Text>

            <View className="w-6" />
          </View>

          <View className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Step 1: MS Type ────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <Text className="text-2xl font-extrabold text-on-surface mb-2">
                What type of MS do you have?
              </Text>
              <Text className="text-on-surface-variant leading-relaxed mb-8 text-sm">
                This calibrates your monitoring protocol to your specific MS course.
              </Text>

              {errors.phenotype && (
                <Text className="text-error text-sm mb-4">{errors.phenotype}</Text>
              )}

              <View style={{ gap: 10 }}>
                {PHENOTYPES.map((item) => (
                  <PhenotypeCard
                    key={item.key}
                    item={item}
                    selected={phenotype === item.key}
                    onPress={() => { setPhenotype(item.key); setErrors({}); }}
                  />
                ))}
              </View>

              <View
                className="mt-6 p-4 bg-surface-container rounded-2xl flex-row items-start"
                style={{ gap: 12 }}
              >
                <Ionicons name="information-circle-outline" size={20} color="#506076" />
                <Text className="flex-1 text-xs text-on-surface-variant leading-5">
                  Not sure which type applies? Your neurologist can confirm this. You can
                  update it later in your profile settings.
                </Text>
              </View>
            </>
          )}

          {/* ── Step 2: Education Level ─────────────────────────────────────── */}
          {step === 2 && (
            <>
              <Text className="text-2xl font-extrabold text-on-surface mb-2">
                What is your education level?
              </Text>
              <Text className="text-on-surface-variant leading-relaxed mb-8 text-sm">
                Education level helps us calibrate your cognitive baseline — higher education
                is associated with higher processing speed scores independent of MS.
              </Text>

              {errors.education && (
                <Text className="text-error text-sm mb-4">{errors.education}</Text>
              )}

              <View style={{ gap: 8 }}>
                {EDUCATION_LEVELS.map((item) => (
                  <EducationCard
                    key={item.key}
                    item={item}
                    selected={education === item.key}
                    onPress={() => { setEducation(item.key); setErrors({}); }}
                  />
                ))}
              </View>
            </>
          )}

          {/* ── Step 3: Clinical & Physical Details ─────────────────────────── */}
          {step === 3 && (
            <>
              <Text className="text-2xl font-extrabold text-on-surface mb-2">
                A little more about you
              </Text>
              <Text className="text-on-surface-variant leading-relaxed mb-8 text-sm">
                These details personalise your baseline. Height and weight help us flag
                fatigue patterns linked to BMI changes over time.
              </Text>

              <View style={{ gap: 20 }}>
                <InputField
                  label="Age"
                  icon="person-outline"
                  placeholder="Range 18–65"
                  value={age}
                  onChangeText={setAge}
                  error={errors.age}
                />

                <View className="flex-row" style={{ gap: 12 }}>
                  <View className="flex-1">
                    <InputField
                      label="Height (cm)"
                      icon="resize-outline"
                      placeholder="e.g. 170"
                      value={heightCm}
                      onChangeText={setHeightCm}
                      error={errors.heightCm}
                    />
                  </View>
                  <View className="flex-1">
                    <InputField
                      label="Weight (kg)"
                      icon="scale-outline"
                      placeholder="e.g. 70"
                      value={weightKg}
                      onChangeText={setWeightKg}
                      error={errors.weightKg}
                    />
                  </View>
                </View>

                <InputField
                  label="Years since diagnosis"
                  icon="calendar-outline"
                  placeholder="e.g. 3"
                  value={yearsDx}
                  onChangeText={setYearsDx}
                  error={errors.yearsDx}
                  hint="Enter 0 if you were recently diagnosed."
                />

                <InputField
                  label="EDSS Score"
                  icon="analytics-outline"
                  optional
                  placeholder="0.0 – 10.0"
                  value={edss}
                  onChangeText={setEdss}
                  error={errors.edss}
                  hint="Expanded Disability Status Scale — your neurologist can provide this. Leave blank if unknown."
                />
              </View>

              {errors._global && (
                <Text className="text-error text-sm text-center mt-6">{errors._global}</Text>
              )}
            </>
          )}
        </ScrollView>

        {/* ── Fixed CTA ───────────────────────────────────────────────────── */}
        <View
          className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4 bg-surface"
          style={{ borderTopWidth: 1, borderTopColor: 'rgba(170,179,184,0.2)' }}
        >
          <TouchableOpacity
            onPress={handleNext}
            disabled={loading}
            className="w-full bg-primary rounded-full py-5 flex-row items-center justify-center"
            style={{ gap: 10, opacity: loading ? 0.7 : 1 }}
            accessibilityRole="button"
            accessibilityLabel={step < TOTAL_STEPS ? 'Next step' : 'Complete setup'}
          >
            {loading ? (
              <ActivityIndicator color="#f1faff" />
            ) : (
              <>
                <Text className="text-on-primary font-bold text-lg">
                  {step < TOTAL_STEPS ? 'Continue' : 'Complete Setup'}
                </Text>
                {step < TOTAL_STEPS && (
                  <Ionicons name="arrow-forward" size={20} color="#f1faff" />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

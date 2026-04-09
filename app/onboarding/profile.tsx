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

// ─── Phenotype config ─────────────────────────────────────────────────────────

const PHENOTYPES: Array<{
  key: MsPhenotype;
  label: string;
  subtitle: string;
  icon: IoniconName;
}> = [
  {
    key: 'RRMS',
    label: 'Relapsing-Remitting MS (RRMS)',
    subtitle: 'The most common form at initial diagnosis.',
    icon: 'refresh-circle-outline',
  },
  {
    key: 'SPMS',
    label: 'Secondary Progressive MS (SPMS)',
    subtitle: 'Steady progression following a relapsing-remitting course.',
    icon: 'trending-up-outline',
  },
  {
    key: 'PPMS',
    label: 'Primary Progressive MS (PPMS)',
    subtitle: 'Steady worsening of neurologic function from onset.',
    icon: 'stats-chart-outline',
  },
  {
    key: 'PRMS',
    label: 'Progressive-Relapsing MS (PRMS)',
    subtitle: 'Steady progression with clear acute relapses.',
    icon: 'warning-outline',
  },
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
      hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={item.label}
      accessibilityHint={item.subtitle}
      className={`flex-row items-start p-5 rounded-xl border-2 ${
        selected
          ? 'bg-surface-container-lowest border-primary'
          : 'bg-surface-container border-transparent'
      }`}
      style={
        selected
          ? {
              shadowColor: '#006880',
              shadowOpacity: 0.14,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            }
          : undefined
      }
    >
      <View
        className={`w-12 h-12 rounded-full items-center justify-center ${
          selected ? 'bg-primary' : 'bg-surface-container-highest'
        }`}
      >
        <Ionicons
          name={item.icon}
          size={24}
          color={selected ? '#f1faff' : '#576065'}
        />
      </View>
      <View className="flex-1 ml-4">
        <Text className="font-bold text-base text-on-surface">{item.label}</Text>
        <Text className="text-sm text-on-surface-variant mt-1">{item.subtitle}</Text>
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={22} color="#006880" />
      )}
    </TouchableOpacity>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: IoniconName; title: string }) {
  return (
    <View className="flex-row items-center mb-6" style={{ gap: 8 }}>
      <Ionicons name={icon} size={22} color="#006880" />
      <Text className="font-bold text-xl text-on-surface">{title}</Text>
    </View>
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
          <View className="bg-primary-container px-2 py-0.5 rounded-full">
            <Text className="text-xs font-bold text-primary uppercase tracking-wider">
              Optional
            </Text>
          </View>
        )}
      </View>
      <View
        className={`flex-row items-center bg-surface-container-highest rounded-xl px-4 py-3 border ${
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
          className="flex-1 text-on-surface font-semibold"
          placeholderTextColor="#737c80"
          keyboardType="numeric"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text className="mt-1 ml-1 text-xs text-error">{error}</Text>
      ) : hint ? (
        <Text className="mt-2 text-xs text-on-surface-variant italic leading-relaxed">{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── ProfileSetup ─────────────────────────────────────────────────────────────

export default function ProfileSetup() {
  const router = useRouter();

  const [phenotype, setPhenotype] = useState<MsPhenotype | null>(null);
  const [yearsDx, setYearsDx] = useState('');
  const [edss, setEdss] = useState('');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!phenotype) {
      next.phenotype = 'Please select your MS type.';
    }

    const yrs = parseInt(yearsDx, 10);
    if (!yearsDx || isNaN(yrs) || yrs < 0) {
      next.yearsDx = 'Enter a valid number of years (0 or more).';
    }

    const ageVal = parseInt(age, 10);
    if (!age || isNaN(ageVal) || ageVal < 18 || ageVal > 65) {
      next.age = 'Age must be between 18 and 65.';
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

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrors({ _global: 'Session expired. Please sign in again.' });
      setLoading(false);
      return;
    }

    // UPDATE — row already exists from the handle_new_user() trigger.
    // created_at is intentionally left unchanged: it acts as enrolled_at
    // for the resolve_monitoring_phase 84-day (12-week) baseline countdown.
    const { error } = await supabase
      .from('profiles')
      .update({
        ms_phenotype: phenotype,
        years_since_diagnosis: parseInt(yearsDx, 10),
        edss_score: edss ? parseFloat(edss) : null,
        age: parseInt(age, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      setErrors({ _global: error.message });
      return;
    }

    router.replace('/');
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-6 py-4 bg-surface"
          style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(170,179,184,0.3)' }}
        >
          <View className="flex-row items-center" style={{ gap: 16 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color="#006880" />
            </TouchableOpacity>
            <Text className="font-bold text-lg text-on-surface">Profile Setup</Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-surface-container items-center justify-center">
            <Ionicons name="person-circle-outline" size={24} color="#006880" />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View className="mb-12">
            <Text className="text-3xl font-extrabold text-on-surface leading-tight mb-4">
              Personalize Your Baseline
            </Text>
            <Text className="text-on-surface-variant leading-relaxed font-medium">
              Providing your clinical details helps us accurately track your MS progression and
              cognitive trends.
            </Text>
          </View>

          {/* MS Phenotype */}
          <View className="mb-12">
            <SectionHeader icon="medical-outline" title="MS Phenotype" />
            {errors.phenotype && (
              <Text className="text-error text-sm mb-4 ml-1">{errors.phenotype}</Text>
            )}
            <View style={{ gap: 12 }}>
              {PHENOTYPES.map((item) => (
                <PhenotypeCard
                  key={item.key}
                  item={item}
                  selected={phenotype === item.key}
                  onPress={() => setPhenotype(item.key)}
                />
              ))}
            </View>
          </View>

          {/* Clinical Details */}
          <View className="mb-12">
            <SectionHeader icon="document-text-outline" title="Clinical Details" />
            <View style={{ gap: 24 }}>
              <InputField
                label="Years since diagnosis"
                icon="calendar-outline"
                placeholder="Enter number of years"
                value={yearsDx}
                onChangeText={setYearsDx}
                error={errors.yearsDx}
              />
              <InputField
                label="Current EDSS Score"
                icon="analytics-outline"
                optional
                placeholder="0.0 – 10.0"
                value={edss}
                onChangeText={setEdss}
                error={errors.edss}
                hint="The Expanded Disability Status Scale helps quantify MS progression."
              />
            </View>
          </View>

          {/* Demographics */}
          <View className="mb-6">
            <SectionHeader icon="person-outline" title="Demographics" />
            <InputField
              label="Age"
              icon="gift-outline"
              placeholder="Range 18–65"
              value={age}
              onChangeText={setAge}
              error={errors.age}
            />
            <View
              className="mt-4 p-4 bg-surface-container rounded-xl flex-row items-start"
              style={{ gap: 12 }}
            >
              <Ionicons name="information-circle-outline" size={20} color="#506076" />
              <Text className="flex-1 text-sm text-on-secondary-container">
                Clinical tracking is currently optimised for adults within this age range to ensure
                data validity.
              </Text>
            </View>
          </View>

          {errors._global && (
            <Text className="text-error text-sm text-center mt-2">{errors._global}</Text>
          )}
        </ScrollView>

        {/* Fixed CTA */}
        <View
          className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4 bg-surface"
          style={{ borderTopWidth: 1, borderTopColor: 'rgba(170,179,184,0.2)' }}
        >
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="w-full bg-primary rounded-full py-5 items-center justify-center"
            style={{ opacity: loading ? 0.7 : 1 }}
            accessibilityRole="button"
            accessibilityLabel="Complete profile setup"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#f1faff" />
            ) : (
              <Text className="text-on-primary font-bold text-lg">Complete Setup</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

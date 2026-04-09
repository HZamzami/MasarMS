import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/types';

const PHENOTYPES = ['RRMS', 'SPMS', 'PPMS'] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const {
    inputAlign,
    messages,
    row,
    textAlign,
    translatePhenotype,
  } = useLocalization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? null);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert(messages.common.error, messages.profile.couldNotLoad);
    } finally {
      setLoading(false);
    }
  }, [messages.common.error, messages.profile.couldNotLoad]);

  useFocusEffect(
    useCallback(() => {
      void fetchProfile();
    }, [fetchProfile])
  );

  const handleUpdate = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          ms_phenotype: profile.ms_phenotype,
          age: profile.age,
          height_cm: profile.height_cm,
          weight_kg: profile.weight_kg,
          years_since_diagnosis: profile.years_since_diagnosis,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      Alert.alert(messages.common.success, messages.profile.updatedSuccessfully);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(messages.common.error, messages.profile.couldNotUpdate);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <LanguageToggleBar />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#006880" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
        >
          <View className="mb-8">
            <Text className="text-3xl font-black text-on-surface tracking-tight" style={textAlign}>
              {messages.profile.title}
            </Text>
            <Text className="text-sm text-on-surface-variant font-bold mt-1" style={textAlign}>
              {email}
            </Text>
          </View>

          <View className="mb-8">
            <Text className="text-xs font-black text-primary uppercase tracking-widest mb-4" style={textAlign}>
              {messages.profile.clinicalInformation}
            </Text>

            <Text className="text-sm font-bold text-on-surface mb-2" style={textAlign}>
              {messages.profile.msPhenotype}
            </Text>
            <View className="flex-row flex-wrap mb-6" style={{ gap: 8 }}>
              {PHENOTYPES.map((phenotype) => (
                <TouchableOpacity
                  key={phenotype}
                  onPress={() => setProfile((prev) => (prev ? { ...prev, ms_phenotype: phenotype } : null))}
                  className={`px-4 py-2.5 rounded-xl border-2 ${
                    profile?.ms_phenotype === phenotype
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface-container-low border-outline-variant/30'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      profile?.ms_phenotype === phenotype ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {translatePhenotype(phenotype)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[row, { gap: 16 }]} className="mb-6">
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface mb-2" style={textAlign}>
                  {messages.profile.age}
                </Text>
                <TextInput
                  value={profile?.age?.toString() ?? ''}
                  onChangeText={(value) => setProfile((prev) => (prev ? { ...prev, age: parseInt(value, 10) || 0 } : null))}
                  keyboardType="numeric"
                  placeholder={messages.profile.agePlaceholder}
                  className="bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30 font-bold text-on-surface"
                  style={inputAlign}
                  placeholderTextColor="#737c80"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface mb-2" style={textAlign}>
                  {messages.profile.diagnosisYears}
                </Text>
                <TextInput
                  value={profile?.years_since_diagnosis?.toString() ?? ''}
                  onChangeText={(value) => setProfile((prev) => (
                    prev ? { ...prev, years_since_diagnosis: parseInt(value, 10) || 0 } : null
                  ))}
                  keyboardType="numeric"
                  placeholder={messages.profile.diagnosisYearsPlaceholder}
                  className="bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30 font-bold text-on-surface"
                  style={inputAlign}
                  placeholderTextColor="#737c80"
                />
              </View>
            </View>
          </View>

          <View className="mb-10">
            <Text className="text-xs font-black text-primary uppercase tracking-widest mb-4" style={textAlign}>
              {messages.profile.biometrics}
            </Text>
            <View style={[row, { gap: 16 }]}>
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface mb-2" style={textAlign}>
                  {messages.profile.height}
                </Text>
                <TextInput
                  value={profile?.height_cm?.toString() ?? ''}
                  onChangeText={(value) => setProfile((prev) => (prev ? { ...prev, height_cm: parseInt(value, 10) || 0 } : null))}
                  keyboardType="numeric"
                  placeholder={messages.profile.heightPlaceholder}
                  className="bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30 font-bold text-on-surface"
                  style={inputAlign}
                  placeholderTextColor="#737c80"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface mb-2" style={textAlign}>
                  {messages.profile.weight}
                </Text>
                <TextInput
                  value={profile?.weight_kg?.toString() ?? ''}
                  onChangeText={(value) => setProfile((prev) => (prev ? { ...prev, weight_kg: parseFloat(value) || 0 } : null))}
                  keyboardType="numeric"
                  placeholder={messages.profile.weightPlaceholder}
                  className="bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30 font-bold text-on-surface"
                  style={inputAlign}
                  placeholderTextColor="#737c80"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleUpdate}
            disabled={saving}
            className="w-full bg-primary py-4 rounded-2xl items-center mb-4 shadow-sm"
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-on-primary font-black uppercase tracking-widest">
                {messages.profile.saveChanges}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => void supabase.auth.signOut()}
            className="w-full bg-surface-container-high py-4 rounded-2xl items-center justify-center mb-8"
            style={row}
          >
            <Ionicons name="log-out-outline" size={20} color="#737c80" />
            <Text className="text-on-surface-variant font-bold" style={{ marginStart: 8 }}>
              {messages.common.signOut}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/database-testing')}
            className="items-center justify-center p-4 rounded-2xl border border-dashed border-outline-variant"
            style={row}
          >
            <Ionicons name="server-outline" size={16} color="#aab3b8" />
            <Text
              className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest"
              style={{ marginStart: 8 }}
            >
              {messages.profile.databaseTesting}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

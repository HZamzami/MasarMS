import React, { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/types';

const PHENOTYPES = [
  { key: 'RRMS', label: 'Relapsing-Remitting' },
  { key: 'SPMS', label: 'Secondary Progressive' },
  { key: 'PPMS', label: 'Primary Progressive' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
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
      Alert.alert('Error', 'Could not load profile data.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const handleUpdate = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
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
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#006880" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
        >
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-black text-on-surface tracking-tight">Your Profile</Text>
            <Text className="text-sm text-on-surface-variant font-bold mt-1">{email}</Text>
          </View>

          {/* Clinical Info Section */}
          <View className="mb-8">
            <Text className="text-xs font-black text-primary uppercase tracking-widest mb-4">Clinical Information</Text>
            
            <Text className="text-sm font-bold text-on-surface mb-2">MS Phenotype</Text>
            <View className="flex-row flex-wrap mb-6" style={{ gap: 8 }}>
              {PHENOTYPES.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setProfile(prev => prev ? ({ ...prev, ms_phenotype: p.key as any }) : null)}
                  className={`px-4 py-2.5 rounded-xl border-2 ${
                    profile?.ms_phenotype === p.key 
                      ? 'bg-primary/10 border-primary' 
                      : 'bg-surface-container-low border-outline-variant/30'
                  }`}
                >
                  <Text className={`text-xs font-bold ${profile?.ms_phenotype === p.key ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row mb-6" style={{ gap: 16 }}>
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface mb-2">Age</Text>
                <TextInput
                  value={profile?.age?.toString() ?? ''}
                  onChangeText={(v) => setProfile(prev => prev ? ({ ...prev, age: parseInt(v) || 0 }) : null)}
                  keyboardType="numeric"
                  placeholder="18-65"
                  className="bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30 font-bold text-on-surface"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface mb-2">Diagnosis (Years)</Text>
                <TextInput
                  value={profile?.years_since_diagnosis?.toString() ?? ''}
                  onChangeText={(v) => setProfile(prev => prev ? ({ ...prev, years_since_diagnosis: parseInt(v) || 0 }) : null)}
                  keyboardType="numeric"
                  placeholder="0+"
                  className="bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30 font-bold text-on-surface"
                />
              </View>
            </View>
          </View>

          {/* Biometrics Section */}
          <View className="mb-10">
            <Text className="text-xs font-black text-primary uppercase tracking-widest mb-4">Biometrics</Text>
            <View className="flex-row" style={{ gap: 16 }}>
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface mb-2">Height (cm)</Text>
                <TextInput
                  value={profile?.height_cm?.toString() ?? ''}
                  onChangeText={(v) => setProfile(prev => prev ? ({ ...prev, height_cm: parseInt(v) || 0 }) : null)}
                  keyboardType="numeric"
                  placeholder="100-250"
                  className="bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30 font-bold text-on-surface"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-on-surface mb-2">Weight (kg)</Text>
                <TextInput
                  value={profile?.weight_kg?.toString() ?? ''}
                  onChangeText={(v) => setProfile(prev => prev ? ({ ...prev, weight_kg: parseFloat(v) || 0 }) : null)}
                  keyboardType="numeric"
                  placeholder="30-300"
                  className="bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30 font-bold text-on-surface"
                />
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            onPress={handleUpdate}
            disabled={saving}
            className="w-full bg-primary py-4 rounded-2xl items-center mb-4 shadow-sm"
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-on-primary font-black uppercase tracking-widest">Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => void supabase.auth.signOut()}
            className="w-full bg-surface-container-high py-4 rounded-2xl items-center flex-row justify-center mb-8"
          >
            <Ionicons name="log-out-outline" size={20} color="#737c80" />
            <Text className="text-on-surface-variant font-bold ml-2">Sign Out</Text>
          </TouchableOpacity>

          {/* Dev testing link */}
          <TouchableOpacity
            onPress={() => router.push('/database-testing')}
            className="flex-row items-center justify-center p-4 rounded-2xl border border-dashed border-outline-variant"
          >
            <Ionicons name="server-outline" size={16} color="#aab3b8" />
            <Text className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-2">
              Dev: Database Testing
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <Text className="text-2xl font-bold text-on-surface">Masar MS</Text>
        <Text className="text-sm text-on-surface-variant mt-1">
          Track your cognitive health
        </Text>
      </View>

      <View className="flex-1 px-6 pt-6" style={{ gap: 16 }}>
        {/* eSDMT test launch card */}
        <TouchableOpacity
          className="bg-primary rounded-3xl p-6"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
          onPress={() => router.push('/tests/esdmt')}
          accessibilityRole="button"
          accessibilityLabel="Start eSDMT cognitive test"
        >
          <MaterialCommunityIcons name="brain" size={36} color="white" />
          <View style={{ flex: 1 }}>
            <Text className="text-on-primary font-bold text-lg">eSDMT Test</Text>
            <Text className="text-on-primary text-sm" style={{ opacity: 0.75 }}>
              90-second cognitive check
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="white" />
        </TouchableOpacity>

        {/* Motor tapping test launch card */}
        <TouchableOpacity
          className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
          onPress={() => router.push('/tests/motor-tapping')}
          accessibilityRole="button"
          accessibilityLabel="Start motor tapping test"
        >
          <View className="w-12 h-12 rounded-2xl bg-primary-container items-center justify-center">
            <Ionicons name="hand-left-outline" size={26} color="#004a5d" />
          </View>
          <View style={{ flex: 1 }}>
            <Text className="text-on-surface font-bold text-lg">Motor Tapping Test</Text>
            <Text className="text-on-surface-variant text-sm">
              10-second motor biomarker capture
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#576065" />
        </TouchableOpacity>

        {/* Mobility test launch card */}
        <TouchableOpacity
          className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
          onPress={() => router.push('/tests/mobility')}
          accessibilityRole="button"
          accessibilityLabel="Start mobility test"
        >
          <View className="w-12 h-12 rounded-2xl bg-tertiary-container items-center justify-center">
            <MaterialCommunityIcons name="walk" size={26} color="#005e54" />
          </View>
          <View style={{ flex: 1 }}>
            <Text className="text-on-surface font-bold text-lg">Mobility & U-Turn Test</Text>
            <Text className="text-on-surface-variant text-sm">
              2-minute gait and turn assessment
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#576065" />
        </TouchableOpacity>

        {/* Info card */}
        <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="bar-chart-outline" size={18} color="#006880" />
            <Text className="text-sm font-semibold text-on-surface">
              12-Week Baseline
            </Text>
          </View>
          <Text className="text-xs text-on-surface-variant leading-5">
            Complete regular eSDMT tests to build your personalised cognitive baseline. Results are stored securely and only visible to you.
          </Text>
        </View>
      </View>

      {/* Sign out */}
      <View className="px-6 pb-6">
        <TouchableOpacity
          className="w-full border border-outline-variant rounded-2xl py-3 items-center flex-row justify-center"
          style={{ gap: 8 }}
          onPress={() => void supabase.auth.signOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={18} color="#576065" />
          <Text className="text-on-surface-variant font-semibold text-sm">
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

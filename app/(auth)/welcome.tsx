import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const FEATURES = [
  {
    icon: 'brain' as const,
    isMCI: true,
    title: 'Cognitive Tracking',
    desc: 'Monitor information processing speed with validated digital tasks.',
  },
  {
    icon: 'hand-left-outline' as const,
    isMCI: false,
    title: 'Motor & Mobility',
    desc: 'Track hand dexterity and walking patterns over time.',
  },
  {
    icon: 'eye-outline' as const,
    isMCI: false,
    title: 'Vision & Fatigue',
    desc: 'Detect contrast sensitivity changes and daily symptom trends.',
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 px-6 pt-12 pb-8 justify-between">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View className="items-center">
          <View
            className="w-24 h-24 rounded-3xl bg-primary-container items-center justify-center mb-8"
            style={{
              shadowColor: '#006880',
              shadowOpacity: 0.18,
              shadowRadius: 20,
              elevation: 6,
            }}
          >
            <MaterialCommunityIcons name="brain" size={52} color="#006880" />
          </View>

          <Text className="text-4xl font-extrabold text-on-surface tracking-tight text-center mb-2">
            Masar MS
          </Text>
          <Text className="text-base text-on-surface-variant text-center leading-relaxed px-4">
            Smartphone-based monitoring designed
            for people living with MS.
          </Text>
        </View>

        {/* ── Feature list ──────────────────────────────────────────────── */}
        <View style={{ gap: 16 }}>
          {FEATURES.map((f) => (
            <View
              key={f.title}
              className="flex-row items-center bg-surface-container-low rounded-2xl p-4"
              style={{ gap: 16 }}
            >
              <View className="w-12 h-12 rounded-2xl bg-primary-container items-center justify-center">
                {f.isMCI ? (
                  <MaterialCommunityIcons name={f.icon as 'brain'} size={24} color="#006880" />
                ) : (
                  <Ionicons
                    name={f.icon as React.ComponentProps<typeof Ionicons>['name']}
                    size={24}
                    color="#006880"
                  />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-bold text-on-surface text-sm">{f.title}</Text>
                <Text className="text-xs text-on-surface-variant mt-0.5 leading-5">{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── CTAs ──────────────────────────────────────────────────────── */}
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login?mode=signup')}
            className="w-full bg-primary rounded-full py-5 items-center"
            accessibilityRole="button"
            accessibilityLabel="Get started — create an account"
          >
            <Text className="text-on-primary font-bold text-lg">Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/login?mode=login')}
            className="w-full py-4 items-center rounded-full border-2 border-outline-variant"
            accessibilityRole="button"
            accessibilityLabel="Sign in to existing account"
          >
            <Text className="text-primary font-bold text-base">I already have an account</Text>
          </TouchableOpacity>

          <Text className="text-xs text-on-surface-variant text-center mt-2 leading-5">
            Your data is encrypted and never shared without consent.
          </Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

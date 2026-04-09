import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';

export default function WelcomeScreen() {
  const router = useRouter();
  const { messages, textAlign, row } = useLocalization();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
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
            {messages.common.appName}
          </Text>
          <Text className="text-base text-on-surface-variant text-center leading-relaxed px-4" style={textAlign}>
            {messages.welcome.subtitle}
          </Text>
        </View>

        {/* ── Feature list ──────────────────────────────────────────────── */}
        <View style={{ gap: 16 }}>
          {messages.welcome.features.map((f, index) => (
            <View
              key={`${f.title}-${index}`}
              className="flex-row items-center bg-surface-container-low rounded-2xl p-4"
              style={[{ gap: 16 }, row]}
            >
              <View className="w-12 h-12 rounded-2xl bg-primary-container items-center justify-center">
                {index === 0 ? (
                  <MaterialCommunityIcons name="brain" size={24} color="#006880" />
                ) : (
                  <Ionicons
                    name={(index === 1 ? 'hand-left-outline' : 'eye-outline') as React.ComponentProps<typeof Ionicons>['name']}
                    size={24}
                    color="#006880"
                  />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-bold text-on-surface text-sm" style={textAlign}>{f.title}</Text>
                <Text className="text-xs text-on-surface-variant mt-0.5 leading-5" style={textAlign}>{f.desc}</Text>
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
            accessibilityLabel={messages.welcome.a11yGetStarted}
          >
            <Text className="text-on-primary font-bold text-lg">{messages.welcome.getStarted}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/login?mode=login')}
            className="w-full py-4 items-center rounded-full border-2 border-outline-variant"
            accessibilityRole="button"
            accessibilityLabel={messages.welcome.a11yHaveAccount}
          >
            <Text className="text-primary font-bold text-base">{messages.welcome.haveAccount}</Text>
          </TouchableOpacity>

          <Text className="text-xs text-on-surface-variant text-center mt-2 leading-5" style={textAlign}>
            {messages.welcome.privacy}
          </Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';

export default function ResultsScreen() {
  const router = useRouter();
  const { formatNumber, messages, row, textAlign } = useLocalization();
  const { attempts, correct } = useLocalSearchParams<{
    attempts: string;
    correct: string;
  }>();

  const totalAttempts = Number(attempts ?? 0);
  const totalCorrect = Number(correct ?? 0);
  const pct = totalAttempts === 0 ? 0 : Math.round((totalCorrect / totalAttempts) * 100);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <View className="items-center justify-between px-6 py-4" style={row}>
        <View className="w-8 h-8" />
        <Text className="text-xl font-bold text-on-surface">{messages.common.appName}</Text>
        <View className="w-8 h-8" />
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-primary-container rounded-full p-6 mb-6">
          <MaterialCommunityIcons name="brain" size={48} color="#006880" />
        </View>

        <Text className="text-2xl font-bold text-on-surface mb-1" style={textAlign}>
          {messages.results.completeTitle}
        </Text>
        <Text className="text-sm text-on-surface-variant mb-8" style={textAlign}>
          {messages.results.subtitle}
        </Text>

        <View className="w-full bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant mb-6">
          <Text className="text-7xl font-bold text-primary text-center">
            {formatNumber(pct)}
            <Text className="text-3xl">%</Text>
          </Text>
          <Text className="text-xs font-semibold text-on-surface-variant text-center uppercase tracking-widest mt-1 mb-6">
            {messages.results.accuracy}
          </Text>

          <View className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden mb-6">
            <View className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </View>

          <View className="justify-around" style={row}>
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-on-surface">{formatNumber(totalCorrect)}</Text>
              <Text className="text-xs text-on-surface-variant">{messages.results.correct}</Text>
            </View>
            <View className="bg-outline-variant" style={{ width: 1, height: '100%' }} />
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-on-surface">{formatNumber(totalAttempts)}</Text>
              <Text className="text-xs text-on-surface-variant">{messages.results.attempts}</Text>
            </View>
            <View className="bg-outline-variant" style={{ width: 1, height: '100%' }} />
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-on-surface">{formatNumber(totalAttempts - totalCorrect)}</Text>
              <Text className="text-xs text-on-surface-variant">{messages.results.errors}</Text>
            </View>
          </View>
        </View>

        <View className="w-full bg-secondary-container rounded-2xl px-4 py-3 mb-8 items-start" style={[row, { gap: 12 }]}>
          <Ionicons name="information-circle-outline" size={18} color="#435368" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-on-secondary-container leading-5" style={textAlign}>
            {messages.results.baselineNote}
          </Text>
        </View>

        <TouchableOpacity
          className="w-full bg-primary rounded-2xl py-4 items-center justify-center"
          style={[row, { gap: 8 }]}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel={messages.results.backToHomeA11y}
        >
          <Ionicons name="home-outline" size={20} color="white" />
          <Text className="text-on-primary font-bold text-base">
            {messages.results.backToHome}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

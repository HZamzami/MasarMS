import { Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function ResultsScreen() {
  const router = useRouter();
  const { attempts, correct } = useLocalSearchParams<{
    attempts: string;
    correct: string;
  }>();

  const totalAttempts = Number(attempts ?? 0);
  const totalCorrect = Number(correct ?? 0);
  const pct =
    totalAttempts === 0
      ? 0
      : Math.round((totalCorrect / totalAttempts) * 100);

  // Accuracy bar fill width (0–100%)
  const barFill = pct;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Top bar */}
      <View className="flex-row justify-between items-center px-6 py-4">
        <View className="w-8 h-8" />
        <Text className="text-xl font-bold text-on-surface">MasarMS</Text>
        <View className="w-8 h-8" />
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {/* Icon */}
        <View className="bg-primary-container rounded-full p-6 mb-6">
          <MaterialCommunityIcons name="brain" size={48} color="#006880" />
        </View>

        {/* Title */}
        <Text className="text-2xl font-bold text-on-surface mb-1">
          Test Complete
        </Text>
        <Text className="text-sm text-on-surface-variant mb-8">
          eSDMT — 90 second session
        </Text>

        {/* Score card */}
        <View className="w-full bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant mb-6">
          {/* Large score */}
          <Text className="text-7xl font-bold text-primary text-center">
            {pct}
            <Text className="text-3xl">%</Text>
          </Text>
          <Text className="text-xs font-semibold text-on-surface-variant text-center uppercase tracking-widest mt-1 mb-6">
            Accuracy
          </Text>

          {/* Accuracy bar */}
          <View className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden mb-6">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${barFill}%` }}
            />
          </View>

          {/* Stats row */}
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-2xl font-bold text-on-surface">
                {totalCorrect}
              </Text>
              <Text className="text-xs text-on-surface-variant">Correct</Text>
            </View>
            <View
              className="bg-outline-variant"
              style={{ width: 1, height: '100%' }}
            />
            <View className="items-center">
              <Text className="text-2xl font-bold text-on-surface">
                {totalAttempts}
              </Text>
              <Text className="text-xs text-on-surface-variant">Attempts</Text>
            </View>
            <View
              className="bg-outline-variant"
              style={{ width: 1, height: '100%' }}
            />
            <View className="items-center">
              <Text className="text-2xl font-bold text-on-surface">
                {totalAttempts - totalCorrect}
              </Text>
              <Text className="text-xs text-on-surface-variant">Errors</Text>
            </View>
          </View>
        </View>

        {/* Baseline note */}
        <View className="w-full bg-secondary-container rounded-2xl px-4 py-3 flex-row items-start gap-3 mb-8">
          <Ionicons name="information-circle-outline" size={18} color="#435368" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-on-secondary-container leading-5">
            Your score will contribute to your personalised 12-week baseline. Complete tests regularly for accurate tracking.
          </Text>
        </View>

        {/* Back to home */}
        <TouchableOpacity
          className="w-full bg-primary rounded-2xl py-4 items-center flex-row justify-center"
          style={{ gap: 8 }}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Ionicons name="home-outline" size={20} color="white" />
          <Text className="text-on-primary font-bold text-base">
            Back to Home
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

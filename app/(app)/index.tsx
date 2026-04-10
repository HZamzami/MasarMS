import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import { supabase } from '../../lib/supabase';
import { getTestSchedule } from '../../lib/scheduling';
import { getStreak } from '../../lib/gamification';
import { detectDecline } from '../../lib/decline';
import type { TestScheduleItem, StreakInfo } from '../../lib/types';

interface DashboardData {
  daysElapsed: number;
  msPhenotype: string | null;
  schedule: TestScheduleItem[];
  streak: StreakInfo;
  alerts: Record<string, 'none' | 'concern' | 'alert'>;
}

const DEFAULT_STREAK: StreakInfo = { currentStreak: 0, longestStreak: 0, lastActiveDateKey: null };

function greeting(messages: ReturnType<typeof useLocalization>['messages']): string {
  const hour = new Date().getHours();
  if (hour < 12) return messages.home.greetingMorning;
  if (hour < 18) return messages.home.greetingAfternoon;
  return messages.home.greetingEvening;
}

function PhaseHeader({ daysElapsed }: { daysElapsed: number }) {
  const { formatMessage, formatNumber, messages, row, textAlign } = useLocalization();
  const isBaseline = daysElapsed < 84;
  const totalDays = 84;
  const weekNum = Math.floor(daysElapsed / 7) + 1;
  const progress = isBaseline ? Math.min(daysElapsed / totalDays, 1) : 1;

  return (
    <View className="bg-surface-container-lowest rounded-3xl p-6 mb-8 shadow-sm">
      <View className="items-center justify-between mb-4" style={row}>
        <View className="flex-1">
          <Text className="text-xs font-bold text-primary uppercase tracking-widest mb-1" style={textAlign}>
            {isBaseline ? messages.home.inductionPhase : messages.home.longitudinalMonitoring}
          </Text>
          <Text className="text-2xl font-black text-on-surface" style={textAlign}>
            {isBaseline
              ? formatMessage(messages.home.weekOfTwelve, { week: formatNumber(weekNum) })
              : messages.home.steadyState}
          </Text>
        </View>
        <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center">
          <Ionicons name={isBaseline ? 'analytics' : 'shield-checkmark'} size={24} color="#006880" />
        </View>
      </View>

      {isBaseline && (
        <>
          <View className="h-2.5 bg-surface-container-high rounded-full overflow-hidden mb-3">
            <View className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
          </View>
          <View className="items-center justify-between" style={row}>
            <Text className="text-[11px] text-on-surface-variant font-bold uppercase tracking-tight" style={textAlign}>
              {formatMessage(messages.home.daysRemaining, {
                days: formatNumber(Math.max(0, 84 - daysElapsed)),
              })}
            </Text>
            <Text className="text-[11px] text-primary font-black uppercase tracking-tight" style={textAlign}>
              {messages.home.establishingBaseline}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function TaskCard({ item, onPress }: { item: TestScheduleItem; onPress: () => void }) {
  const {
    chevronForwardIcon,
    formatDate,
    formatMessage,
    messages,
    row,
    textAlign,
    translateDomain,
    translateTestType,
  } = useLocalization();
  const isLocked = item.status === 'upcoming' || item.status === 'completed';

  const renderIcon = () => {
    switch (item.testType) {
      case 'DailyEMA':
        return <Ionicons name="sunny-outline" size={22} color="#006880" />;
      case 'eSDMT':
        return <MaterialCommunityIcons name="brain" size={22} color="#006880" />;
      case 'FingerTapping':
        return <Ionicons name="hand-left-outline" size={22} color="#006880" />;
      case 'PinchDrag':
        return <Ionicons name="finger-print-outline" size={22} color="#006880" />;
      case '2MWT':
        return <MaterialCommunityIcons name="walk" size={22} color="#006880" />;
      case 'ContrastSensitivity':
        return <Ionicons name="eye-outline" size={22} color="#006880" />;
      case 'MSIS29':
        return <Ionicons name="clipboard-outline" size={22} color="#006880" />;
      default:
        return <Ionicons name="flask-outline" size={22} color="#006880" />;
    }
  };

  const subtitle = item.status === 'upcoming'
    ? formatMessage(messages.home.availableOn, {
      date: formatDate(item.nextAvailableAt, { month: 'short', day: 'numeric' }),
    })
    : item.status === 'completed'
      ? messages.home.completedForInterval
      : translateDomain(item.domain);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLocked}
      className={`items-center p-4 rounded-2xl mb-3 ${
        isLocked ? 'bg-surface-container-lowest opacity-50' : 'bg-surface-container-low border border-outline-variant/30 shadow-sm'
      }`}
      style={[row, { gap: 16 }]}
    >
      <View
        className="w-12 h-12 bg-surface-container-lowest rounded-xl items-center justify-center"
      >
        {renderIcon()}
      </View>

      <View className="flex-1">
        <View className="items-center justify-between" style={row}>
          <Text className={`font-bold ${isLocked ? 'text-on-surface-variant' : 'text-on-surface'} text-base`} style={textAlign}>
            {translateTestType(item.testType)}
          </Text>
          {item.status === 'overdue' ? (
            <Text className="text-[10px] font-black text-error uppercase tracking-tighter" style={textAlign}>
              {messages.home.overdue}
            </Text>
          ) : null}
        </View>
        <Text className="text-[11px] text-on-surface-variant font-medium mt-0.5" style={textAlign}>
          {subtitle}
        </Text>
      </View>

      {!isLocked ? (
        <Ionicons name={chevronForwardIcon} size={18} color="#aab3b8" />
      ) : null}
      {item.status === 'completed' ? (
        <Ionicons name="checkmark-circle" size={20} color="#006b60" />
      ) : null}
    </TouchableOpacity>
  );
}

function FrequencySection({
  title,
  items,
  daysElapsed,
  router,
}: {
  title: string;
  items: TestScheduleItem[];
  daysElapsed: number;
  router: ReturnType<typeof useRouter>;
}) {
  const { messages, row, textAlign } = useLocalization();
  if (items.length === 0) return null;

  const isBaseline = daysElapsed < 84;

  return (
    <View className="mb-8">
      <View className="items-baseline justify-between mb-4 px-1" style={row}>
        <Text className="text-sm font-black text-on-surface uppercase tracking-widest" style={textAlign}>
          {title}
        </Text>
        {isBaseline && title !== messages.home.dailyProtocol ? (
          <View className="bg-primary/5 px-2 py-0.5 rounded-md">
            <Text className="text-[9px] font-bold text-primary uppercase">
              {messages.home.inductionThreeTimes}
            </Text>
          </View>
        ) : null}
      </View>
      {items.map((item) => (
        <TaskCard key={item.testType} item={item} onPress={() => router.push(item.route as never)} />
      ))}
    </View>
  );
}

function HealthStatusSection({ alerts }: { alerts: Record<string, 'none' | 'concern' | 'alert'> }) {
  const { messages, row, textAlign } = useLocalization();
  const alertCount = Object.values(alerts).filter((value) => value === 'alert').length;
  const concernCount = Object.values(alerts).filter((value) => value === 'concern').length;

  const statusLabel = alertCount > 0
    ? messages.home.actionRequired
    : concernCount > 0
      ? messages.home.underReview
      : messages.home.allStable;

  const statusColor = alertCount > 0 ? 'bg-error' : concernCount > 0 ? 'bg-warning' : 'bg-success';

  const domains = [
    { key: 'cognitive', type: 'eSDMT' },
    { key: 'motor', type: 'FingerTapping' },
    { key: 'mobility', type: '2MWT' },
    { key: 'vision', type: 'ContrastSensitivity' },
  ] as const;

  return (
    <View className="bg-surface-container-lowest rounded-3xl p-6 mb-8 shadow-sm">
      <View className="items-center justify-between mb-4" style={row}>
        <Text className="text-sm font-black text-on-surface uppercase tracking-widest" style={textAlign}>
          {messages.home.biomarkerStatus}
        </Text>
        <View className="items-center" style={[row, { gap: 6 }]}>
          <View className={`w-2 h-2 rounded-full ${statusColor}`} />
          <Text className="text-[10px] font-bold text-on-surface-variant uppercase" style={textAlign}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View className="justify-between" style={row}>
        {domains.map((domain) => {
          const severity = alerts[domain.type] ?? 'none';
          const color = severity === 'alert' ? '#ba1a1a' : severity === 'concern' ? '#b97c00' : '#006b60';
          const bgColor = severity === 'alert' ? '#ffdad6' : severity === 'concern' ? '#ffe08d' : '#e2fff8';

          return (
            <View key={domain.key} className="flex-1 items-center">
              <View
                className="w-10 h-10 rounded-2xl items-center justify-center mb-2"
                style={{ backgroundColor: bgColor }}
              >
                {domain.key === 'cognitive' ? (
                  <MaterialCommunityIcons name="brain" size={20} color={color} />
                ) : domain.key === 'motor' ? (
                  <Ionicons name="hand-left-outline" size={20} color={color} />
                ) : domain.key === 'mobility' ? (
                  <MaterialCommunityIcons name="walk" size={20} color={color} />
                ) : (
                  <Ionicons name="eye-outline" size={20} color={color} />
                )}
              </View>
              <Text className="text-[9px] font-black text-on-surface-variant uppercase" style={textAlign}>
                {messages.home.statusDomains[domain.key]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const {
    formatDate,
    formatMessage,
    formatNumber,
    messages,
    row,
    textAlign,
  } = useLocalization();
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<DashboardData>({
    daysElapsed: 0,
    msPhenotype: null,
    schedule: [],
    streak: DEFAULT_STREAK,
    alerts: {},
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadDashboard() {
        setLoading(true);
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user || !active) return;

          const uid = user.id;
          const [profileRes, schedule, streak] = await Promise.all([
            supabase.from('profiles').select('created_at, ms_phenotype').eq('id', uid).single(),
            getTestSchedule(uid),
            getStreak(uid),
          ]);

          const activeTestTypes = ['eSDMT', 'FingerTapping', 'PinchDrag', '2MWT', 'ContrastSensitivity'];
          const alertResults = await Promise.all(activeTestTypes.map((type) => detectDecline(uid, type)));

          const alerts: Record<string, 'none' | 'concern' | 'alert'> = {};
          alertResults.forEach((result, index) => {
            if (result) alerts[activeTestTypes[index]] = result.severity;
          });

          const enrolledAt = profileRes.data?.created_at ? new Date(profileRes.data.created_at).getTime() : Date.now();
          const daysElapsed = Math.max(0, Math.floor((Date.now() - enrolledAt) / 86_400_000));

          if (active) {
            setDash({
              daysElapsed,
              msPhenotype: profileRes.data?.ms_phenotype ?? null,
              schedule,
              streak,
              alerts,
            });
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadDashboard();
      return () => {
        active = false;
      };
    }, [])
  );

  const dueTasks = dash.schedule.filter((item) => item.status === 'due' || item.status === 'overdue');
  const dailyTasks = dash.schedule.filter((item) => item.frequencyLabel === 'Daily');
  const weeklyTasks = dash.schedule.filter((item) => item.frequencyLabel === 'Weekly');
  const biweeklyTasks = dash.schedule.filter((item) => item.frequencyLabel === 'Biweekly');
  const monthlyTasks = dash.schedule.filter((item) => item.frequencyLabel === 'Monthly');

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      >
        <View className="items-center justify-between mb-8" style={row}>
          <View className="flex-1">
            <Text className="text-2xl font-black text-on-surface tracking-tight" style={textAlign}>
              {greeting(messages)}
            </Text>
            <Text className="text-sm text-on-surface-variant font-bold mt-0.5" style={textAlign}>
              {formatDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>

          <View className="items-center" style={[row, { gap: 10 }]}>
            {dash.streak.currentStreak > 1 ? (
              <View
                className="bg-tertiary-container px-3 py-1.5 rounded-full items-center"
                style={[row, { gap: 6 }]}
              >
                <Text style={{ fontSize: 14 }}>🔥</Text>
                <Text className="text-xs font-black text-on-surface-variant">
                  {formatNumber(dash.streak.currentStreak)}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              className="w-11 h-11 rounded-2xl bg-primary-container items-center justify-center border border-primary/10"
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel={messages.home.profileButtonA11y}
            >
              <Ionicons name="person" size={20} color="#006880" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#006880" />
            <Text className="text-on-surface-variant font-bold mt-4" style={textAlign}>
              {messages.home.syncingProtocol}
            </Text>
          </View>
        ) : (
          <>
            <PhaseHeader daysElapsed={dash.daysElapsed} />
            <HealthStatusSection alerts={dash.alerts} />

            {dueTasks.length > 0 ? (
              <View className="mb-10">
                <View className="items-center justify-between mb-4 px-1" style={row}>
                  <Text className="text-lg font-black text-on-surface tracking-tight" style={textAlign}>
                    {messages.home.actionRequiredTitle}
                  </Text>
                  <View className="bg-error-container px-2.5 py-1 rounded-lg">
                    <Text className="text-[10px] font-black text-error uppercase">
                      {formatMessage(messages.home.pendingCount, {
                        count: formatNumber(dueTasks.length),
                      })}
                    </Text>
                  </View>
                </View>
                {dueTasks.map((item) => (
                  <TaskCard key={`due-${item.testType}`} item={item} onPress={() => router.push(item.route as never)} />
                ))}
              </View>
            ) : null}

            <Text className="text-xl font-black text-on-surface tracking-tight mb-6 px-1" style={textAlign}>
              {messages.home.protocolSchedule}
            </Text>

            <FrequencySection title={messages.home.dailyProtocol} items={dailyTasks} daysElapsed={dash.daysElapsed} router={router} />
            <FrequencySection title={messages.home.weeklyActiveTests} items={weeklyTasks} daysElapsed={dash.daysElapsed} router={router} />
            <FrequencySection title={messages.home.biweeklyAssessments} items={biweeklyTasks} daysElapsed={dash.daysElapsed} router={router} />
            <FrequencySection title={messages.home.monthlyReview} items={monthlyTasks} daysElapsed={dash.daysElapsed} router={router} />

            <View className="mt-8 pt-8 border-t border-outline-variant/30">
              <TouchableOpacity
                onPress={() => void supabase.auth.signOut()}
                className="items-center justify-center py-4 rounded-2xl bg-surface-container-high"
                style={[row, { gap: 8 }]}
              >
                <Ionicons name="log-out-outline" size={18} color="#737c80" />
                <Text className="text-sm text-on-surface-variant font-bold">
                  {messages.common.signOut}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

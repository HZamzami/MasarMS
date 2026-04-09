import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '../../lib/supabase';
import { getTestSchedule } from '../../lib/scheduling';
import { getStreak } from '../../lib/gamification';
import { detectDecline } from '../../lib/decline';
import type {
  DailyEMAData,
  EsdmtData,
  FingerTappingData,
  MSIS29Data,
  MobilityData,
  PinchDragData,
  VisionContrastData,
  TestScheduleItem,
  StreakInfo,
  DeclineReport,
} from '../../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Row<T> = { data: T; created_at: string } | null;

interface DashboardData {
  daysElapsed: number;
  msPhenotype: string | null;
  userHandle: string;
  esdmt: Row<EsdmtData>;
  tapping: Row<FingerTappingData>;
  pinchDrag: Row<PinchDragData>;
  mobility: Row<MobilityData>;
  vision: Row<VisionContrastData>;
  ema: Row<DailyEMAData>;
  msis29: Row<MSIS29Data>;
  schedule: TestScheduleItem[];
  streak: StreakInfo;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

async function latestResult(uid: string, testType: string) {
  return supabase
    .from('test_results')
    .select('data, created_at')
    .eq('user_id', uid)
    .eq('test_type', testType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

const MOOD_EMOJIS = ['😫', '🙁', '😐', '🙂', '🤩'] as const;

const DEFAULT_STREAK: StreakInfo = { currentStreak: 0, longestStreak: 0, lastActiveDateKey: null };

// ─── BaselineCard ─────────────────────────────────────────────────────────────

function BaselineCard({
  daysElapsed,
  msPhenotype,
}: {
  daysElapsed: number;
  msPhenotype: string | null;
}) {
  const pct = Math.round((Math.min(daysElapsed, 84) / 84) * 100);

  return (
    <View
      className="bg-surface-container-lowest rounded-3xl p-6"
      style={{
        shadowColor: '#2b3438',
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center justify-between mb-5">
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <View className="w-11 h-11 rounded-2xl bg-primary-container items-center justify-center">
            <Ionicons name="analytics-outline" size={22} color="#004a5d" />
          </View>
          <View>
            <Text className="text-base font-bold text-on-surface">Baseline Progress</Text>
            <Text className="text-sm text-on-surface-variant">
              Day {Math.min(daysElapsed, 84)} of 84
            </Text>
          </View>
        </View>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          {msPhenotype && (
            <View className="bg-surface-container px-2.5 py-1 rounded-full">
              <Text className="text-xs font-bold text-primary">{msPhenotype}</Text>
            </View>
          )}
          <View className="bg-primary px-2.5 py-1 rounded-full">
            <Text className="text-xs font-bold text-on-primary">{pct}%</Text>
          </View>
        </View>
      </View>

      {/* Progress track */}
      <View className="h-3 bg-surface-container-highest rounded-full overflow-hidden">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${pct}%` }}
        />
      </View>

      <Text className="text-xs text-on-surface-variant mt-3 leading-5">
        Consistent daily tracking helps us understand your specific MS pattern
        for more accurate insights.
      </Text>
    </View>
  );
}

// ─── DeclineAlert ─────────────────────────────────────────────────────────────

function DeclineAlert({ report }: { report: DeclineReport }) {
  const isAlert = report.severity === 'alert';
  const pct = Math.abs(Math.round(report.pctChange * 100));

  const DOMAIN_LABELS: Record<string, string> = {
    eSDMT: 'cognitive',
    FingerTapping: 'motor',
    '2MWT': 'mobility',
    ContrastSensitivity: 'vision',
    DailyEMA: 'mood',
  };
  const domainLabel = DOMAIN_LABELS[report.testType] ?? report.domain;

  return (
    <View
      className="rounded-3xl p-5 flex-row items-start"
      style={{
        backgroundColor: isAlert ? 'rgba(168,56,54,0.07)' : 'rgba(255,171,0,0.07)',
        borderWidth: 1,
        borderColor: isAlert ? 'rgba(168,56,54,0.2)' : 'rgba(255,171,0,0.25)',
        gap: 14,
      }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: isAlert ? 'rgba(168,56,54,0.12)' : 'rgba(255,171,0,0.12)' }}
      >
        <Ionicons
          name="warning-outline"
          size={20}
          color={isAlert ? '#a83836' : '#b97c00'}
        />
      </View>
      <View className="flex-1">
        <Text
          className="font-bold text-sm mb-0.5"
          style={{ color: isAlert ? '#a83836' : '#7a5200' }}
        >
          {isAlert ? 'Possible decline detected' : 'Performance concern'}
        </Text>
        <Text className="text-xs text-on-surface-variant leading-5">
          Your {domainLabel} scores are {pct}% below baseline for{' '}
          {report.sustainedWeeks} consecutive{' '}
          {report.sustainedWeeks === 1 ? 'week' : 'weeks'}.
          Consider discussing with your care team.
        </Text>
      </View>
    </View>
  );
}

// ─── CheckinCard ──────────────────────────────────────────────────────────────

function CheckinCard({
  result,
  scheduleItem,
  onPress,
}: {
  result: Row<DailyEMAData>;
  scheduleItem?: TestScheduleItem;
  onPress: () => void;
}) {
  const doneToday = result !== null && isToday(result.created_at);
  const moodEmoji = doneToday ? MOOD_EMOJIS[result!.data.mood_index] : null;

  if (doneToday) {
    return (
      <View
        className="rounded-3xl p-6 flex-row items-center justify-between"
        style={{ backgroundColor: 'rgba(0,107,96,0.07)', borderWidth: 1, borderColor: 'rgba(0,107,96,0.12)' }}
      >
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <View
            className="w-14 h-14 rounded-full bg-tertiary items-center justify-center"
            style={{ shadowColor: '#006b60', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
          >
            <Text style={{ fontSize: 26 }}>{moodEmoji}</Text>
          </View>
          <View>
            <Text className="text-base font-bold text-on-surface">Check-in Complete</Text>
            <Text className="text-sm text-on-surface-variant">
              Mood & energy logged at {formatTime(result!.created_at)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onPress}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: 'rgba(0,107,96,0.12)' }}
          accessibilityLabel="Edit daily check-in"
        >
          <Ionicons name="create-outline" size={18} color="#006b60" />
        </TouchableOpacity>
      </View>
    );
  }

  // Show overdue/due badge if schedule data available
  const overdueDays = scheduleItem && scheduleItem.isOverdue
    ? Math.abs(Math.floor(scheduleItem.daysUntilDue))
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface-container-lowest rounded-3xl p-6 flex-row items-center justify-between"
      style={{
        shadowColor: '#2b3438',
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
      }}
      accessibilityRole="button"
      accessibilityLabel="Start daily check-in"
    >
      <View className="flex-row items-center" style={{ gap: 14 }}>
        <View className="w-14 h-14 rounded-full bg-tertiary items-center justify-center">
          <Ionicons name="heart-outline" size={28} color="white" />
        </View>
        <View>
          <Text className="text-base font-bold text-on-surface">Daily Check-in</Text>
          <Text className="text-sm text-on-surface-variant">
            {overdueDays !== null && overdueDays > 0
              ? `${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue`
              : 'Tap to log mood & energy'}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {overdueDays !== null && overdueDays > 0 && (
          <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(168,56,54,0.1)' }}>
            <Text className="text-xs font-bold" style={{ color: '#a83836' }}>Overdue</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color="#737c80" />
      </View>
    </TouchableOpacity>
  );
}

// ─── BiomarkerCard ────────────────────────────────────────────────────────────

type BiomarkerIcon =
  | { type: 'ion'; name: React.ComponentProps<typeof Ionicons>['name'] }
  | { type: 'mci'; name: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };

function ScheduleBadge({ scheduleItem, completedToday }: {
  scheduleItem?: TestScheduleItem;
  completedToday: boolean;
}) {
  if (completedToday) {
    return (
      <View className="bg-tertiary-container px-2.5 py-1 rounded-full flex-row items-center" style={{ gap: 4 }}>
        <Ionicons name="checkmark-circle" size={12} color="#006b60" />
        <Text className="text-xs font-bold" style={{ color: '#006b60' }}>Done</Text>
      </View>
    );
  }

  if (!scheduleItem) return null;

  if (scheduleItem.isDueToday) {
    return (
      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,171,0,0.15)' }}>
        <Text className="text-xs font-bold" style={{ color: '#b97c00' }}>Due today</Text>
      </View>
    );
  }

  if (scheduleItem.isOverdue) {
    const days = Math.abs(Math.floor(scheduleItem.daysUntilDue));
    return (
      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(168,56,54,0.1)' }}>
        <Text className="text-xs font-bold" style={{ color: '#a83836' }}>
          {days}d late
        </Text>
      </View>
    );
  }

  return null;
}

function BiomarkerCard({
  domainLabel,
  title,
  icon,
  metric,
  unit,
  completedToday,
  scheduleItem,
  onPress,
}: {
  domainLabel: string;
  title: string;
  icon: BiomarkerIcon;
  metric: string | null;
  unit: string;
  completedToday: boolean;
  scheduleItem?: TestScheduleItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 bg-surface-container-low rounded-3xl p-5"
      style={{ minHeight: 160 }}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${metric ?? 'no data'} ${unit}`}
    >
      {/* Top row */}
      <View className="flex-row items-center justify-between mb-6">
        <View
          className="w-11 h-11 rounded-2xl bg-surface-container-lowest items-center justify-center"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
        >
          {icon.type === 'mci' ? (
            <MaterialCommunityIcons name={icon.name} size={22} color="#006880" />
          ) : (
            <Ionicons name={icon.name} size={22} color="#006880" />
          )}
        </View>
        <ScheduleBadge scheduleItem={scheduleItem} completedToday={completedToday} />
      </View>

      {/* Label + title */}
      <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">
        {domainLabel}
      </Text>
      <Text className="text-sm font-bold text-on-surface mb-3">{title}</Text>

      {/* Metric */}
      <View className="flex-row items-baseline" style={{ gap: 4 }}>
        <Text
          className="font-extrabold"
          style={{ fontSize: 36, lineHeight: 40, color: metric ? '#006880' : '#aab3b8' }}
        >
          {metric ?? '—'}
        </Text>
        {metric && (
          <Text className="text-sm font-bold text-on-surface-variant">{unit}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

function SkeletonCard({ tall }: { tall?: boolean }) {
  return (
    <View
      className="flex-1 bg-surface-container-high rounded-3xl"
      style={{ minHeight: tall ? 120 : 160 }}
    />
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────

function BottomNav({ active }: { active: 'home' | 'trends' | 'history' | 'profile' }) {
  const router = useRouter();
  const items = [
    { key: 'home',    icon: 'home',           label: 'Home',    route: '/'       },
    { key: 'trends',  icon: 'trending-up',    label: 'Trends',  route: '/trends' },
    { key: 'history', icon: 'time-outline',   label: 'History', route: null      },
    { key: 'profile', icon: 'person-outline', label: 'Profile', route: null      },
  ] as const;

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row justify-around items-center px-4 pt-3 pb-6 bg-surface-container-lowest"
      style={{
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(170,179,184,0.2)',
        shadowColor: '#2b3438',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {items.map(({ key, icon, label, route }) => {
        const isActive = key === active;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => route ? router.push(route as never) : undefined}
            disabled={!route}
            className={`flex-col items-center justify-center py-2 px-4 rounded-2xl ${
              isActive ? 'bg-primary/10' : ''
            }`}
          >
            <Ionicons
              name={icon as React.ComponentProps<typeof Ionicons>['name']}
              size={22}
              color={isActive ? '#006880' : '#aab3b8'}
            />
            <Text
              className="text-xs font-semibold mt-1"
              style={{ color: isActive ? '#006880' : '#aab3b8' }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<DashboardData>({
    daysElapsed: 0,
    msPhenotype: null,
    userHandle: 'there',
    esdmt: null,
    tapping: null,
    pinchDrag: null,
    mobility: null,
    vision: null,
    ema: null,
    msis29: null,
    schedule: [],
    streak: DEFAULT_STREAK,
  });
  const [declineReports, setDeclineReports] = useState<DeclineReport[]>([]);

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
          const handle = user.email?.split('@')[0] ?? 'there';

          const [profileRes, esdmtRes, tappingRes, pinchDragRes, mobilityRes, visionRes, emaRes, msis29Res, schedule, streak] =
            await Promise.all([
              supabase
                .from('profiles')
                .select('created_at, ms_phenotype')
                .eq('id', uid)
                .single(),
              latestResult(uid, 'eSDMT'),
              latestResult(uid, 'FingerTapping'),
              latestResult(uid, 'PinchDrag'),
              latestResult(uid, '2MWT'),
              latestResult(uid, 'ContrastSensitivity'),
              latestResult(uid, 'DailyEMA'),
              latestResult(uid, 'MSIS29'),
              getTestSchedule(uid),
              getStreak(uid),
            ]);

          const enrolledAt = profileRes.data?.created_at
            ? new Date(profileRes.data.created_at).getTime()
            : Date.now();
          const daysElapsed = Math.max(
            0,
            Math.floor((Date.now() - enrolledAt) / 86_400_000)
          );

          if (active) {
            setDash({
              daysElapsed,
              msPhenotype: profileRes.data?.ms_phenotype ?? null,
              userHandle: handle,
              esdmt: esdmtRes.data as Row<EsdmtData>,
              tapping: tappingRes.data as Row<FingerTappingData>,
              pinchDrag: pinchDragRes.data as Row<PinchDragData>,
              mobility: mobilityRes.data as Row<MobilityData>,
              vision: visionRes.data as Row<VisionContrastData>,
              ema: emaRes.data as Row<DailyEMAData>,
              msis29: msis29Res.data as Row<MSIS29Data>,
              schedule,
              streak,
            });
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      async function loadDeclineNonBlocking(uid: string) {
        // Runs after main data — does not block dashboard render
        const TEST_TYPES = ['eSDMT', 'FingerTapping', '2MWT', 'ContrastSensitivity'];
        const results = await Promise.all(
          TEST_TYPES.map((t) => detectDecline(uid, t))
        );
        const alerts = results.filter(
          (r): r is DeclineReport => r !== null && r.severity !== 'none'
        );
        if (active) setDeclineReports(alerts);
      }

      void loadDashboard().then(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && active) void loadDeclineNonBlocking(user.id);
      });

      return () => { active = false; };
    }, [])
  );

  // Schedule lookup helpers
  const scheduleFor = (testType: string) =>
    dash.schedule.find((s) => s.testType === testType);

  // Metric derivations
  const esdmtMetric = dash.esdmt
    ? String((dash.esdmt.data as EsdmtData).ips_score)
    : null;
  const tappingMetric = dash.tapping
    ? (dash.tapping.data as FingerTappingData).frequency_hz.toFixed(1)
    : null;
  const pinchDragMetric = dash.pinchDrag
    ? String(Math.round((dash.pinchDrag.data as PinchDragData).accuracy_pct))
    : null;
  const mobilityMetric = dash.mobility
    ? String((dash.mobility.data as MobilityData).u_turn_count)
    : null;
  const visionMetric = dash.vision
    ? String(
        Math.round(
          (1 - (dash.vision.data as VisionContrastData).final_contrast_threshold) * 100
        )
      )
    : null;
  const msis29Metric = dash.msis29
    ? String((dash.msis29.data as MSIS29Data).total_score)
    : null;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between mb-8">
          <View>
            <Text className="text-2xl font-extrabold text-on-surface">
              {greeting()}, {dash.userHandle}
            </Text>
            <Text className="text-sm text-on-surface-variant mt-0.5">{todayLabel()}</Text>
          </View>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            {/* Streak pill — only shown when user has an active streak */}
            {dash.streak.currentStreak > 1 && (
              <View
                className="bg-tertiary-container px-3 py-1.5 rounded-full flex-row items-center"
                style={{ gap: 6 }}
              >
                <Text style={{ fontSize: 14 }}>🔥</Text>
                <Text className="text-xs font-bold text-on-surface-variant">
                  {dash.streak.currentStreak}d streak
                </Text>
              </View>
            )}
            <View
              className="w-11 h-11 rounded-full bg-primary-container items-center justify-center"
              style={{ borderWidth: 2, borderColor: 'rgba(0,104,128,0.15)' }}
            >
              <Ionicons name="person" size={20} color="#006880" />
            </View>
          </View>
        </View>

        {loading ? (
          /* ── Skeleton ──────────────────────────────────────────────────── */
          <View style={{ gap: 16 }}>
            <SkeletonCard tall />
            <SkeletonCard tall />
            <View className="flex-row" style={{ gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {/* ── Baseline Progress ────────────────────────────────────────── */}
            <BaselineCard
              daysElapsed={dash.daysElapsed}
              msPhenotype={dash.msPhenotype}
            />

            {/* ── Decline alerts (non-blocking — appear after main data) ───── */}
            {declineReports.map((report) => (
              <DeclineAlert key={report.testType} report={report} />
            ))}

            {/* ── Daily Check-in ───────────────────────────────────────────── */}
            <CheckinCard
              result={dash.ema}
              scheduleItem={scheduleFor('DailyEMA')}
              onPress={() => router.push('/tests/daily-checkin')}
            />

            {/* ── Active Biomarkers header ─────────────────────────────────── */}
            <View className="flex-row items-center justify-between mt-2 px-1">
              <Text className="text-lg font-extrabold text-on-surface">Active Biomarkers</Text>
              <View className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-xs font-bold text-primary">Latest result</Text>
              </View>
            </View>

            {/* ── Biomarker grid ────────────────────────────────────────────── */}
            <View style={{ gap: 12 }}>
              <View className="flex-row" style={{ gap: 12 }}>
                <BiomarkerCard
                  domainLabel="Cognitive"
                  title="Processing Speed"
                  icon={{ type: 'mci', name: 'brain' }}
                  metric={esdmtMetric}
                  unit="pts"
                  completedToday={dash.esdmt !== null && isToday(dash.esdmt.created_at)}
                  scheduleItem={scheduleFor('eSDMT')}
                  onPress={() => router.push('/tests/esdmt')}
                />
                <BiomarkerCard
                  domainLabel="Motor · Tap"
                  title="Hand Dexterity"
                  icon={{ type: 'ion', name: 'hand-left-outline' }}
                  metric={tappingMetric}
                  unit="Hz"
                  completedToday={dash.tapping !== null && isToday(dash.tapping.created_at)}
                  scheduleItem={scheduleFor('FingerTapping')}
                  onPress={() => router.push('/tests/motor-tapping')}
                />
              </View>
              <View className="flex-row" style={{ gap: 12 }}>
                <BiomarkerCard
                  domainLabel="Motor · Pinch"
                  title="Fine Control"
                  icon={{ type: 'ion', name: 'finger-print-outline' }}
                  metric={pinchDragMetric}
                  unit="%"
                  completedToday={dash.pinchDrag !== null && isToday(dash.pinchDrag.created_at)}
                  scheduleItem={scheduleFor('PinchDrag')}
                  onPress={() => router.push('/tests/pinch-drag')}
                />
                <BiomarkerCard
                  domainLabel="Mobility"
                  title="Gait & Walk"
                  icon={{ type: 'mci', name: 'walk' }}
                  metric={mobilityMetric}
                  unit="turns"
                  completedToday={dash.mobility !== null && isToday(dash.mobility.created_at)}
                  scheduleItem={scheduleFor('2MWT')}
                  onPress={() => router.push('/tests/mobility')}
                />
              </View>
              <View className="flex-row" style={{ gap: 12 }}>
                <BiomarkerCard
                  domainLabel="Vision"
                  title="Contrast Test"
                  icon={{ type: 'ion', name: 'eye-outline' }}
                  metric={visionMetric}
                  unit="%"
                  completedToday={dash.vision !== null && isToday(dash.vision.created_at)}
                  scheduleItem={scheduleFor('ContrastSensitivity')}
                  onPress={() => router.push('/tests/vision')}
                />
                <BiomarkerCard
                  domainLabel="QoL Survey"
                  title="MS Impact"
                  icon={{ type: 'ion', name: 'clipboard-outline' }}
                  metric={msis29Metric}
                  unit="/100"
                  completedToday={dash.msis29 !== null && isToday(dash.msis29.created_at)}
                  scheduleItem={scheduleFor('MSIS29')}
                  onPress={() => router.push('/tests/msis29')}
                />
              </View>
            </View>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <View className="mt-4" style={{ gap: 12 }}>
              {/* Dev testing card */}
              <TouchableOpacity
                onPress={() => router.push('/database-testing')}
                className="flex-row items-center p-4 rounded-2xl border border-outline-variant"
                style={{ gap: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Open database testing"
              >
                <Ionicons name="server-outline" size={18} color="#737c80" />
                <Text className="flex-1 text-sm font-medium text-on-surface-variant">
                  Dev: Database Testing
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#aab3b8" />
              </TouchableOpacity>

              {/* Sign out */}
              <TouchableOpacity
                onPress={() => void supabase.auth.signOut()}
                className="items-center py-3"
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Text className="text-sm text-on-surface-variant">Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <BottomNav active="home" />
    </SafeAreaView>
  );
}

import React, { useState, useCallback } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '../../lib/supabase';
import { getTestSchedule } from '../../lib/scheduling';
import { getStreak } from '../../lib/gamification';
import { detectDecline } from '../../lib/decline';
import type {
  EsdmtData,
  FingerTappingData,
  MSIS29Data,
  MobilityData,
  PinchDragData,
  VisionContrastData,
  TestScheduleItem,
  StreakInfo,
  DailyEMAData,
} from '../../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Row<T> = { data: T; created_at: string } | null;

interface DashboardData {
  daysElapsed: number;
  msPhenotype: string | null;
  schedule: TestScheduleItem[];
  streak: StreakInfo;
  alerts: Record<string, 'none' | 'concern' | 'alert'>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const DEFAULT_STREAK: StreakInfo = { currentStreak: 0, longestStreak: 0, lastActiveDateKey: null };

// ─── Components ──────────────────────────────────────────────────────────────

function PhaseHeader({ daysElapsed }: { daysElapsed: number }) {
  const isBaseline = daysElapsed < 84;
  const totalDays = isBaseline ? 84 : 0;
  const weekNum = Math.floor(daysElapsed / 7) + 1;
  const progress = isBaseline ? Math.min(daysElapsed / totalDays, 1) : 1;

  return (
    <View className="bg-surface-container-lowest rounded-3xl p-6 mb-8 shadow-sm">
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
            {isBaseline ? 'Induction Phase' : 'Longitudinal Monitoring'}
          </Text>
          <Text className="text-2xl font-black text-on-surface">
            {isBaseline ? `Week ${weekNum} of 12` : 'Steady State'}
          </Text>
        </View>
        <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center">
          <Ionicons name={isBaseline ? 'analytics' : 'shield-checkmark'} size={24} color="#006880" />
        </View>
      </View>
      
      {isBaseline && (
        <>
          <View className="h-2.5 bg-surface-container-high rounded-full overflow-hidden mb-3">
            <View 
              className="h-full bg-primary" 
              style={{ width: `${progress * 100}%` }} 
            />
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[11px] text-on-surface-variant font-bold uppercase tracking-tight">
              {84 - daysElapsed} days remaining
            </Text>
            <Text className="text-[11px] text-primary font-black uppercase tracking-tight">
              Establishing Baseline
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function TaskCard({ item, onPress, compact = false }: { item: TestScheduleItem; onPress: () => void, compact?: boolean }) {
  const isLocked = item.status === 'upcoming' || item.status === 'completed';
  
  const getIcon = () => {
    const size = compact ? 20 : 22;
    switch (item.testType) {
      case 'DailyEMA': return <Ionicons name="sunny-outline" size={size} color="#006880" />;
      case 'eSDMT': return <MaterialCommunityIcons name="brain" size={size} color="#006880" />;
      case 'FingerTapping': return <Ionicons name="hand-left-outline" size={size} color="#006880" />;
      case 'PinchDrag': return <Ionicons name="finger-print-outline" size={size} color="#006880" />;
      case '2MWT': return <MaterialCommunityIcons name="walk" size={size} color="#006880" />;
      case 'ContrastSensitivity': return <Ionicons name="eye-outline" size={size} color="#006880" />;
      case 'MSIS29': return <Ionicons name="clipboard-outline" size={size} color="#006880" />;
      default: return <Ionicons name="flask-outline" size={size} color="#006880" />;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLocked}
      className={`flex-row items-center p-4 rounded-2xl mb-3 ${
        isLocked ? 'bg-surface-container-lowest opacity-50' : 'bg-surface-container-low border border-outline-variant/30 shadow-sm'
      }`}
    >
      <View className={`rounded-xl items-center justify-center mr-4 ${compact ? 'w-10 h-10' : 'w-12 h-12 bg-surface-container-lowest'}`}>
        {getIcon()}
      </View>
      
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className={`font-bold ${isLocked ? 'text-on-surface-variant' : 'text-on-surface'} ${compact ? 'text-sm' : 'text-base'}`}>
            {item.label}
          </Text>
          {item.status === 'overdue' && (
            <Text className="text-[10px] font-black text-error uppercase tracking-tighter">Overdue</Text>
          )}
        </View>
        <Text className="text-[11px] text-on-surface-variant font-medium mt-0.5">
          {item.status === 'upcoming' 
            ? `Available ${new Date(item.nextAvailableAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` 
            : item.status === 'completed'
            ? 'Completed for this interval'
            : item.domain.charAt(0).toUpperCase() + item.domain.slice(1)}
        </Text>
      </View>

      {!isLocked && (
        <Ionicons name="chevron-forward" size={18} color="#aab3b8" />
      )}
      {item.status === 'completed' && (
        <Ionicons name="checkmark-circle" size={20} color="#006b60" />
      )}
    </TouchableOpacity>
  );
}

function FrequencySection({ title, items, daysElapsed, router }: { title: string, items: TestScheduleItem[], daysElapsed: number, router: any }) {
  if (items.length === 0) return null;
  
  const isBaseline = daysElapsed < 84;
  
  return (
    <View className="mb-8">
      <View className="flex-row items-baseline justify-between mb-4 px-1">
        <Text className="text-sm font-black text-on-surface uppercase tracking-widest">{title}</Text>
        {isBaseline && title !== 'Daily Protocol' && (
          <View className="bg-primary/5 px-2 py-0.5 rounded-md">
            <Text className="text-[9px] font-bold text-primary uppercase">Induction: 3x/week</Text>
          </View>
        )}
      </View>
      {items.map(item => (
        <TaskCard key={item.testType} item={item} onPress={() => router.push(item.route as never)} />
      ))}
    </View>
  );
}

function HealthStatusSection({ alerts }: { alerts: Record<string, 'none' | 'concern' | 'alert'> }) {
  const hasAlerts = Object.values(alerts).some(v => v !== 'none');
  const alertCount = Object.values(alerts).filter(v => v === 'alert').length;
  const concernCount = Object.values(alerts).filter(v => v === 'concern').length;

  return (
    <View className="bg-surface-container-lowest rounded-3xl p-6 mb-8 shadow-sm">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-sm font-black text-on-surface uppercase tracking-widest">Biomarker Status</Text>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <View className={`w-2 h-2 rounded-full ${alertCount > 0 ? 'bg-error' : concernCount > 0 ? 'bg-warning' : 'bg-success'}`} />
          <Text className="text-[10px] font-bold text-on-surface-variant uppercase">
            {alertCount > 0 ? 'Action Required' : concernCount > 0 ? 'Under Review' : 'All Stable'}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between" style={{ gap: 8 }}>
        {['Cognitive', 'Motor', 'Mobility', 'Vision'].map((domain) => {
          // Map domain name to test type for lookup
          const typeMap: Record<string, string> = { 
            'Cognitive': 'eSDMT', 
            'Motor': 'FingerTapping', 
            'Mobility': '2MWT', 
            'Vision': 'ContrastSensitivity' 
          };
          const type = typeMap[domain];
          const severity = alerts[type] ?? 'none';
          
          const color = severity === 'alert' ? '#ba1a1a' : severity === 'concern' ? '#b97c00' : '#006b60';
          const bgColor = severity === 'alert' ? '#ffdad6' : severity === 'concern' ? '#ffe08d' : '#e2fff8';

          return (
            <View key={domain} className="flex-1 items-center">
              <View 
                className="w-10 h-10 rounded-2xl items-center justify-center mb-2"
                style={{ backgroundColor: bgColor }}
              >
                <Ionicons 
                  name={domain === 'Cognitive' ? 'brain' : domain === 'Motor' ? 'hand-left' : domain === 'Mobility' ? 'walk' : 'eye'} 
                  size={20} 
                  color={color} 
                />
              </View>
              <Text className="text-[9px] font-black text-on-surface-variant uppercase">{domain}</Text>
            </View>
          );
        })}
      </View>
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
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          const uid = user.id;
          const [profileRes, schedule, streak] = await Promise.all([
            supabase.from('profiles').select('created_at, ms_phenotype').eq('id', uid).single(),
            getTestSchedule(uid),
            getStreak(uid),
          ]);

          // Fetch alerts for active tests
          const activeTestTypes = ['eSDMT', 'FingerTapping', 'PinchDrag', '2MWT', 'ContrastSensitivity'];
          const alertPromises = activeTestTypes.map(type => detectDecline(uid, type));
          const alertResults = await Promise.all(alertPromises);
          
          const alerts: Record<string, 'none' | 'concern' | 'alert'> = {};
          alertResults.forEach((res, i) => {
            if (res) alerts[activeTestTypes[i]] = res.severity;
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
      return () => { active = false; };
    }, [])
  );

  const dueTasks = dash.schedule.filter(s => s.status === 'due' || s.status === 'overdue');
  
  const dailyTasks = dash.schedule.filter(s => s.frequencyLabel === 'Daily');
  const weeklyTasks = dash.schedule.filter(s => s.frequencyLabel === 'Weekly');
  const biweeklyTasks = dash.schedule.filter(s => s.frequencyLabel === 'Biweekly');
  const monthlyTasks = dash.schedule.filter(s => s.frequencyLabel === 'Monthly');

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between mb-8">
          <View>
            <Text className="text-2xl font-black text-on-surface tracking-tight">{greeting()}</Text>
            <Text className="text-sm text-on-surface-variant font-bold mt-0.5">{todayLabel()}</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            {dash.streak.currentStreak > 1 && (
              <View className="bg-tertiary-container px-3 py-1.5 rounded-full flex-row items-center" style={{ gap: 6 }}>
                <Text style={{ fontSize: 14 }}>🔥</Text>
                <Text className="text-xs font-black text-on-surface-variant">{dash.streak.currentStreak}</Text>
              </View>
            )}
            <TouchableOpacity 
              className="w-11 h-11 rounded-2xl bg-primary-container items-center justify-center border border-primary/10"
              onPress={() => router.push('/profile')}
            >
              <Ionicons name="person" size={20} color="#006880" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-on-surface-variant font-bold animate-pulse">Syncing Protocol...</Text>
          </View>
        ) : (
          <>
            <PhaseHeader daysElapsed={dash.daysElapsed} />
            <HealthStatusSection alerts={dash.alerts} />

            {/* ── Action Required ─────────────────────────────────────────── */}
            {dueTasks.length > 0 && (
              <View className="mb-10">
                <View className="flex-row items-center justify-between mb-4 px-1">
                  <Text className="text-lg font-black text-on-surface tracking-tight">Action Required</Text>
                  <View className="bg-error-container px-2.5 py-1 rounded-lg">
                    <Text className="text-[10px] font-black text-error uppercase">{dueTasks.length} pending</Text>
                  </View>
                </View>
                {dueTasks.map(item => (
                  <TaskCard key={`due-${item.testType}`} item={item} onPress={() => router.push(item.route as never)} />
                ))}
              </View>
            )}

            {/* ── Protocol Schedule ───────────────────────────────────────── */}
            <Text className="text-xl font-black text-on-surface tracking-tight mb-6 px-1">Protocol Schedule</Text>

            <FrequencySection title="Daily Protocol" items={dailyTasks} daysElapsed={dash.daysElapsed} router={router} />
            <FrequencySection title="Weekly Active Tests" items={weeklyTasks} daysElapsed={dash.daysElapsed} router={router} />
            <FrequencySection title="Biweekly Assessments" items={biweeklyTasks} daysElapsed={dash.daysElapsed} router={router} />
            <FrequencySection title="Monthly Review" items={monthlyTasks} daysElapsed={dash.daysElapsed} router={router} />

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <View className="mt-8 pt-8 border-t border-outline-variant/30">
              <TouchableOpacity
                onPress={() => void supabase.auth.signOut()}
                className="flex-row items-center justify-center py-4 rounded-2xl bg-surface-container-high"
              >
                <Ionicons name="log-out-outline" size={18} color="#737c80" />
                <Text className="text-sm text-on-surface-variant font-bold ml-2">Sign Out</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

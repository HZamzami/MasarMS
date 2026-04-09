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

const DEFAULT_STREAK: StreakInfo = { currentStreak: 0, longestStreak: 0, lastActiveDateKey: null };

// ─── PhaseHeader ─────────────────────────────────────────────────────────────

function PhaseHeader({ daysElapsed }: { daysElapsed: number }) {
  const isBaseline = daysElapsed < 84;
  const totalDays = isBaseline ? 84 : 0;
  const weekNum = Math.floor(daysElapsed / 7) + 1;
  const progress = isBaseline ? Math.min(daysElapsed / totalDays, 1) : 1;

  return (
    <View className="bg-surface-container-lowest rounded-3xl p-6 mb-4 shadow-sm">
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-sm font-bold text-primary uppercase tracking-wider">
            {isBaseline ? 'Baseline Phase' : 'Longitudinal Monitoring'}
          </Text>
          <Text className="text-xl font-extrabold text-on-surface">
            {isBaseline ? `Week ${weekNum} of 12` : 'Steady State'}
          </Text>
        </View>
        <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
          <Ionicons name={isBaseline ? 'analytics' : 'shield-checkmark'} size={24} color="#006880" />
        </View>
      </View>
      
      {isBaseline && (
        <>
          <View className="h-2 bg-surface-container-high rounded-full overflow-hidden mb-2">
            <View 
              className="h-full bg-primary" 
              style={{ width: `${progress * 100}%` }} 
            />
          </View>
          <Text className="text-xs text-on-surface-variant font-medium">
            {84 - daysElapsed} days remaining to establish your digital twin
          </Text>
        </>
      )}
    </View>
  );
}

// ─── TaskCard ────────────────────────────────────────────────────────────────

function TaskCard({ item, onPress }: { item: TestScheduleItem; onPress: () => void }) {
  const isLocked = item.status === 'upcoming' || item.status === 'completed';
  
  const getIcon = () => {
    switch (item.testType) {
      case 'DailyEMA': return <Ionicons name="sunny-outline" size={22} color="#006880" />;
      case 'eSDMT': return <MaterialCommunityIcons name="brain" size={22} color="#006880" />;
      case 'FingerTapping': return <Ionicons name="hand-left-outline" size={22} color="#006880" />;
      case 'PinchDrag': return <Ionicons name="finger-print-outline" size={22} color="#006880" />;
      case '2MWT': return <MaterialCommunityIcons name="walk" size={22} color="#006880" />;
      case 'ContrastSensitivity': return <Ionicons name="eye-outline" size={22} color="#006880" />;
      case 'MSIS29': return <Ionicons name="clipboard-outline" size={22} color="#006880" />;
      default: return <Ionicons name="flask-outline" size={22} color="#006880" />;
    }
  };

  const getStatusBadge = () => {
    if (item.status === 'overdue') {
      return (
        <View className="bg-error-container px-2 py-0.5 rounded-md">
          <Text className="text-[10px] font-bold text-error uppercase">Overdue</Text>
        </View>
      );
    }
    if (item.status === 'completed' || item.status === 'upcoming') {
      return (
        <View className="bg-surface-container-high px-2 py-0.5 rounded-md">
          <Text className="text-[10px] font-bold text-on-surface-variant uppercase">Locked</Text>
        </View>
      );
    }
    return (
      <View className="bg-primary/10 px-2 py-0.5 rounded-md">
        <Text className="text-[10px] font-bold text-primary uppercase">Due</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLocked}
      className={`flex-row items-center p-4 rounded-2xl mb-3 ${
        isLocked ? 'bg-surface-container-lowest opacity-60' : 'bg-surface-container-low shadow-sm'
      }`}
      style={!isLocked ? { borderLeftWidth: 4, borderLeftColor: item.status === 'overdue' ? '#ba1a1a' : '#006880' } : {}}
    >
      <View className="w-12 h-12 rounded-xl bg-surface-container-lowest items-center justify-center mr-4">
        {getIcon()}
      </View>
      
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className={`font-bold ${isLocked ? 'text-on-surface-variant' : 'text-on-surface'}`}>
            {item.label}
          </Text>
          {getStatusBadge()}
        </View>
        <Text className="text-xs text-on-surface-variant">
          {item.status === 'upcoming' 
            ? `Next: ${new Date(item.nextAvailableAt).toLocaleDateString()}` 
            : item.status === 'completed'
            ? 'Completed for today'
            : item.domain.charAt(0).toUpperCase() + item.domain.slice(1)}
        </Text>
      </View>

      {!isLocked && (
        <Ionicons name="chevron-forward" size={20} color="#aab3b8" />
      )}
    </TouchableOpacity>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<DashboardData>({
    daysElapsed: 0,
    msPhenotype: null,
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

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadDashboard() {
        setLoading(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || !active) return;

          const uid = user.id;
          const [profileRes, esdmtRes, tappingRes, pinchDragRes, mobilityRes, visionRes, emaRes, msis29Res, schedule, streak] =
            await Promise.all([
              supabase.from('profiles').select('created_at, ms_phenotype').eq('id', uid).single(),
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

          const enrolledAt = profileRes.data?.created_at ? new Date(profileRes.data.created_at).getTime() : Date.now();
          const daysElapsed = Math.max(0, Math.floor((Date.now() - enrolledAt) / 86_400_000));

          if (active) {
            setDash({
              daysElapsed,
              msPhenotype: profileRes.data?.ms_phenotype ?? null,
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

      void loadDashboard();
      return () => { active = false; };
    }, [])
  );

  const dueTasks = dash.schedule.filter(s => s.status === 'due' || s.status === 'overdue');
  const otherTasks = dash.schedule.filter(s => s.status === 'upcoming' || s.status === 'completed');

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between mb-8">
          <View>
            <Text className="text-2xl font-extrabold text-on-surface">{greeting()}</Text>
            <Text className="text-sm text-on-surface-variant mt-0.5">{todayLabel()}</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {dash.streak.currentStreak > 1 && (
              <View className="bg-tertiary-container px-3 py-1.5 rounded-full flex-row items-center" style={{ gap: 6 }}>
                <Text style={{ fontSize: 14 }}>🔥</Text>
                <Text className="text-xs font-bold text-on-surface-variant">{dash.streak.currentStreak}d streak</Text>
              </View>
            )}
            <View className="w-11 h-11 rounded-full bg-primary-container items-center justify-center">
              <Ionicons name="person" size={20} color="#006880" />
            </View>
          </View>
        </View>

        {loading ? (
          <View className="opacity-20"><PhaseHeader daysElapsed={0} /></View>
        ) : (
          <>
            <PhaseHeader daysElapsed={dash.daysElapsed} />

            {/* ── Active Tasks ────────────────────────────────────────────── */}
            <View className="mt-4">
              <View className="flex-row items-center justify-between mb-4 px-1">
                <Text className="text-lg font-extrabold text-on-surface">Your Tasks</Text>
                <View className="bg-primary/10 px-3 py-1 rounded-full">
                  <Text className="text-xs font-bold text-primary">{dueTasks.length} pending</Text>
                </View>
              </View>

              {dueTasks.length > 0 ? (
                dueTasks.map(item => (
                  <TaskCard 
                    key={item.testType} 
                    item={item} 
                    onPress={() => router.push(item.route as never)} 
                  />
                ))
              ) : (
                <View className="bg-surface-container-lowest rounded-3xl p-8 items-center justify-center border border-dashed border-outline-variant">
                  <Ionicons name="checkmark-done-circle" size={48} color="#006b60" />
                  <Text className="text-on-surface font-bold mt-4 text-center">All caught up!</Text>
                  <Text className="text-on-surface-variant text-xs mt-1 text-center">Check back later for your next scheduled tests.</Text>
                </View>
              )}
            </View>

            {/* ── Upcoming ────────────────────────────────────────────────── */}
            {otherTasks.length > 0 && (
              <View className="mt-8">
                <Text className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-4 px-1">
                  Completed & Upcoming
                </Text>
                {otherTasks.map(item => (
                  <TaskCard 
                    key={item.testType} 
                    item={item} 
                    onPress={() => {}} 
                  />
                ))}
              </View>
            )}

            {/* ── Sign out ──────────────────────────────────────────────────── */}
            <TouchableOpacity
              onPress={() => void supabase.auth.signOut()}
              className="items-center py-8"
            >
              <Text className="text-sm text-on-surface-variant font-medium">Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ── Bottom Nav Placeholder ───────────────────────────────────── */}
      <View className="absolute bottom-0 left-0 right-0 h-20 bg-surface/80 items-center justify-center border-t border-outline-variant">
         <Text className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
           MasarMS Clinical Suite
         </Text>
      </View>
    </SafeAreaView>
  );
}

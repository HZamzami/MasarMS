import { supabase } from './supabase';
import type { Badge, BadgeType, StreakInfo } from './types';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return toDateKey(new Date().toISOString());
}

function dateKeyOf(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toDateKey(d.toISOString());
}

// ─── Streak ───────────────────────────────────────────────────────────────────

/**
 * Computes current and longest streak from test_results.
 * A "day" counts as active if the user completed at least one test on that
 * calendar date. Gaps of exactly 1 day break the current streak.
 */
export async function getStreak(userId: string): Promise<StreakInfo> {
  const { data: rows } = await supabase
    .from('test_results')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(180);

  if (!rows || rows.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDateKey: null };
  }

  // Unique active date keys, sorted descending
  const activeDays = Array.from(
    new Set(rows.map((r) => toDateKey(r.created_at as string)))
  ).sort((a, b) => b.localeCompare(a));

  const lastActiveDateKey = activeDays[0] ?? null;

  // Current streak: walk backwards from today
  let currentStreak = 0;
  for (let d = 0; d < 180; d++) {
    const key = dateKeyOf(d);
    if (activeDays.includes(key)) {
      currentStreak++;
    } else if (d === 0) {
      // Today has no activity yet — check if yesterday was active (streak intact)
      continue;
    } else {
      break;
    }
  }

  // Longest streak: full scan
  let longestStreak = 0;
  let run = 0;

  // Sort ascending for forward scan
  const ascending = [...activeDays].sort();
  for (let i = 0; i < ascending.length; i++) {
    if (i === 0) {
      run = 1;
    } else {
      // Check if this day is exactly 1 day after the previous
      const prev = new Date(ascending[i - 1]);
      const curr = new Date(ascending[i]);
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / 86_400_000
      );
      if (diffDays === 1) {
        run++;
      } else {
        run = 1;
      }
    }
    longestStreak = Math.max(longestStreak, run);
  }

  return { currentStreak, longestStreak, lastActiveDateKey };
}

// ─── Badge definitions ────────────────────────────────────────────────────────

const BADGE_DEFS: Record<BadgeType, Omit<Badge, 'earned' | 'earnedAt'>> = {
  first_test: {
    type: 'first_test',
    label: 'First Step',
    icon: 'flag-outline',
    description: 'Completed your very first test.',
  },
  streak_7: {
    type: 'streak_7',
    label: 'Week Warrior',
    icon: 'flame-outline',
    description: '7 consecutive days of monitoring.',
  },
  streak_30: {
    type: 'streak_30',
    label: 'Monthly Champion',
    icon: 'trophy-outline',
    description: '30 consecutive days of monitoring.',
  },
  baseline_complete: {
    type: 'baseline_complete',
    label: 'Baseline Builder',
    icon: 'analytics-outline',
    description: 'Completed the full 84-day baseline window.',
  },
  all_domains_day: {
    type: 'all_domains_day',
    label: 'Full Sweep',
    icon: 'checkmark-done-outline',
    description: 'Completed all test domains in a single day.',
  },
  sessions_10: {
    type: 'sessions_10',
    label: 'Consistent',
    icon: 'ribbon-outline',
    description: 'Completed 10 total test sessions.',
  },
  sessions_50: {
    type: 'sessions_50',
    label: 'Dedicated',
    icon: 'medal-outline',
    description: 'Completed 50 total test sessions.',
  },
};

const ALL_TEST_DOMAINS = new Set([
  'DailyEMA',
  'eSDMT',
  'FingerTapping',
  '2MWT',
  'ContrastSensitivity',
]);

interface BadgeContext {
  daysElapsed: number;
  currentStreak: number;
  longestStreak: number;
}

/**
 * Returns all badges with their earned state for a user.
 * Uses a single aggregate query for counts; badge evaluation is pure TS.
 */
export async function getBadges(
  userId: string,
  ctx: BadgeContext,
): Promise<Badge[]> {
  // One query: per-test-type counts + today's test types
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [countRes, todayRes] = await Promise.all([
    supabase
      .from('test_results')
      .select('test_type')
      .eq('user_id', userId),
    supabase
      .from('test_results')
      .select('test_type')
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString()),
  ]);

  const totalTests = countRes.data?.length ?? 0;
  const todayTypes = new Set(todayRes.data?.map((r) => r.test_type as string) ?? []);
  const allDomainsToday = ALL_TEST_DOMAINS.size === todayTypes.size &&
    [...ALL_TEST_DOMAINS].every((t) => todayTypes.has(t));

  const conditions: Record<BadgeType, boolean> = {
    first_test:        totalTests >= 1,
    streak_7:          ctx.longestStreak >= 7,
    streak_30:         ctx.longestStreak >= 30,
    baseline_complete: ctx.daysElapsed >= 84,
    all_domains_day:   allDomainsToday,
    sessions_10:       totalTests >= 10,
    sessions_50:       totalTests >= 50,
  };

  return (Object.keys(BADGE_DEFS) as BadgeType[]).map((type) => ({
    ...BADGE_DEFS[type],
    earned: conditions[type],
    earnedAt: null, // Exact earn date not tracked — would need a separate table
  }));
}

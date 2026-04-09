import { supabase } from './supabase';
import type { MsDomain, TestScheduleItem } from './types';

// ─── Protocol config ──────────────────────────────────────────────────────────

interface ScheduleConfig {
  testType: string;
  domain: MsDomain;
  label: string;
  route: string;
  intervalDays: number;
}

export const SCHEDULE_CONFIG: ReadonlyArray<ScheduleConfig> = [
  { testType: 'DailyEMA',            domain: 'mood',          label: 'Daily Check-in',  route: '/tests/daily-checkin',  intervalDays: 1  },
  { testType: 'eSDMT',               domain: 'cognitive',     label: 'Cognitive',        route: '/tests/esdmt',          intervalDays: 7  },
  { testType: 'FingerTapping',       domain: 'motor',         label: 'Motor Tapping',    route: '/tests/motor-tapping',  intervalDays: 7  },
  { testType: '2MWT',                domain: 'mobility',      label: 'Mobility',         route: '/tests/mobility',       intervalDays: 14 },
  { testType: 'ContrastSensitivity', domain: 'physiological', label: 'Vision',           route: '/tests/vision',         intervalDays: 14 },
] as const;

// ─── Schedule computation ─────────────────────────────────────────────────────

/**
 * Returns the full test schedule for a user with due/overdue state computed.
 * Uses a single GROUP BY query — not N separate queries.
 */
export async function getTestSchedule(userId: string): Promise<TestScheduleItem[]> {
  const testTypes = SCHEDULE_CONFIG.map((c) => c.testType);

  const { data: rows } = await supabase
    .from('test_results')
    .select('test_type, created_at')
    .eq('user_id', userId)
    .in('test_type', testTypes)
    .order('created_at', { ascending: false });

  // Build a map: testType → most recent created_at
  const lastCompletedMap = new Map<string, string>();
  if (rows) {
    for (const row of rows) {
      if (!lastCompletedMap.has(row.test_type)) {
        lastCompletedMap.set(row.test_type, row.created_at as string);
      }
    }
  }

  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  return SCHEDULE_CONFIG.map((cfg) => {
    const lastCompletedAt = lastCompletedMap.get(cfg.testType) ?? null;

    const daysSinceLast = lastCompletedAt
      ? Math.floor((now - new Date(lastCompletedAt).getTime()) / MS_PER_DAY)
      : Infinity;

    const daysUntilDue = isFinite(daysSinceLast)
      ? cfg.intervalDays - daysSinceLast
      : -cfg.intervalDays; // never done → overdue by the full interval

    const isDueToday = daysUntilDue <= 0 && daysUntilDue > -1;
    const isOverdue = daysUntilDue < 0;

    return {
      testType: cfg.testType,
      domain: cfg.domain,
      label: cfg.label,
      route: cfg.route,
      intervalDays: cfg.intervalDays,
      lastCompletedAt,
      daysUntilDue,
      isDueToday,
      isOverdue,
    };
  });
}

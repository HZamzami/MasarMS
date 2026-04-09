import { supabase } from './supabase';
import type { MsDomain, TestScheduleItem, TestStatus } from './types';

// ─── Protocol config ──────────────────────────────────────────────────────────

const BASELINE_WINDOW_MS = 12 * 7 * 24 * 60 * 60 * 1000; // 84 days
const MS_PER_DAY = 86_400_000;

interface ScheduleConfig {
  testType: string;
  domain: MsDomain;
  label: string;
  route: string;
  baselineIntervalDays: number;
  longitudinalIntervalDays: number;
  frequencyLabel: 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly';
}

/**
 * Aligns with Section 8:
 * - Daily: EMA
 * - Weekly: eSDMT + One Motor (Tapping & Pinch/Drag both weekly for simplicity)
 * - Biweekly: Mobility (2MWT) + Vision
 * - Monthly: MSIS29
 * 
 * During Baseline: All Active tests (everything except EMA/MSIS29) are 3x/week.
 */
export const SCHEDULE_CONFIG: ReadonlyArray<ScheduleConfig> = [
  { 
    testType: 'DailyEMA',            
    domain: 'mood',          
    label: 'Daily Mood Check-in', 
    route: '/tests/daily-checkin',  
    baselineIntervalDays: 1, 
    longitudinalIntervalDays: 1,
    frequencyLabel: 'Daily'
  },
  { 
    testType: 'eSDMT',               
    domain: 'cognitive',     
    label: 'Cognitive (eSDMT)',       
    route: '/tests/esdmt',          
    baselineIntervalDays: 2.33, 
    longitudinalIntervalDays: 7,
    frequencyLabel: 'Weekly'
  },
  { 
    testType: 'FingerTapping',       
    domain: 'motor',         
    label: 'Hand Dexterity (Tapping)',   
    route: '/tests/motor-tapping',  
    baselineIntervalDays: 2.33, 
    longitudinalIntervalDays: 7,
    frequencyLabel: 'Weekly'
  },
  { 
    testType: 'PinchDrag',           
    domain: 'motor',         
    label: 'Fine Control (Pinch)',    
    route: '/tests/pinch-drag',     
    baselineIntervalDays: 2.33, 
    longitudinalIntervalDays: 7,
    frequencyLabel: 'Weekly'
  },
  { 
    testType: '2MWT',                
    domain: 'mobility',      
    label: 'Mobility (2MWT)',         
    route: '/tests/mobility',       
    baselineIntervalDays: 2.33, 
    longitudinalIntervalDays: 14,
    frequencyLabel: 'Biweekly'
  },
  { 
    testType: 'ContrastSensitivity', 
    domain: 'physiological', 
    label: 'Vision (Contrast)',           
    route: '/tests/vision',         
    baselineIntervalDays: 2.33, 
    longitudinalIntervalDays: 14,
    frequencyLabel: 'Biweekly'
  },
  { 
    testType: 'MSIS29',              
    domain: 'mood',          
    label: 'Impact Survey (MSIS29)',      
    route: '/tests/msis29',         
    baselineIntervalDays: 30, 
    longitudinalIntervalDays: 30,
    frequencyLabel: 'Monthly'
  },
] as const;

// ─── Schedule computation ─────────────────────────────────────────────────────

export async function getTestSchedule(userId: string): Promise<TestScheduleItem[]> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();

  const enrolledAt = profile?.created_at ? new Date(profile.created_at).getTime() : Date.now();
  const now = Date.now();
  const daysSinceEnrolled = (now - enrolledAt) / MS_PER_DAY;
  const isBaselinePhase = daysSinceEnrolled < 84; // 12 weeks

  const testTypes = SCHEDULE_CONFIG.map((c) => c.testType);
  const { data: rows } = await supabase
    .from('test_results')
    .select('test_type, created_at')
    .eq('user_id', userId)
    .in('test_type', testTypes)
    .order('created_at', { ascending: false });

  const lastCompletedMap = new Map<string, string>();
  if (rows) {
    for (const row of rows) {
      if (!lastCompletedMap.has(row.test_type)) {
        lastCompletedMap.set(row.test_type, row.created_at as string);
      }
    }
  }

  return SCHEDULE_CONFIG.map((cfg) => {
    const lastCompletedAt = lastCompletedMap.get(cfg.testType) ?? null;
    const intervalDays = isBaselinePhase ? cfg.baselineIntervalDays : cfg.longitudinalIntervalDays;
    
    let daysUntilDue = 0;
    if (lastCompletedAt) {
      const msSinceLast = now - new Date(lastCompletedAt).getTime();
      const daysSinceLast = msSinceLast / MS_PER_DAY;
      daysUntilDue = intervalDays - daysSinceLast;
    }

    let status: TestStatus = 'due';
    if (!lastCompletedAt) {
      status = 'due';
    } else if (daysUntilDue <= 0) {
      status = daysUntilDue < -1 ? 'overdue' : 'due';
    } else if (daysUntilDue > 0) {
      const lastCompletedDate = new Date(lastCompletedAt);
      const today = new Date();
      const doneToday = 
        lastCompletedDate.getDate() === today.getDate() &&
        lastCompletedDate.getMonth() === today.getMonth() &&
        lastCompletedDate.getFullYear() === today.getFullYear();
      
      if (intervalDays > 1) {
        status = 'upcoming';
      } else {
        status = doneToday ? 'completed' : 'due';
      }
    }

    const nextAvailableAt = lastCompletedAt 
      ? new Date(new Date(lastCompletedAt).getTime() + (intervalDays * MS_PER_DAY)).toISOString()
      : new Date().toISOString();

    return {
      testType: cfg.testType,
      domain: cfg.domain,
      label: cfg.label,
      route: cfg.route,
      intervalDays,
      frequencyLabel: cfg.frequencyLabel,
      lastCompletedAt,
      daysUntilDue,
      status,
      nextAvailableAt,
    };
  });
}

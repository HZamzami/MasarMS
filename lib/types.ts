// ─── Domain & Phase enums ─────────────────────────────────────────────────────

export type MsDomain =
  | 'cognitive'
  | 'motor'
  | 'mobility'
  | 'fatigue'
  | 'sleep'
  | 'mood'
  | 'physiological';

export type MonitoringPhase = 'baseline' | 'longitudinal';

// ─── Database row types ───────────────────────────────────────────────────────

export interface Profile {
  id: string;
  ms_phenotype: 'RRMS' | 'SPMS' | 'PPMS' | null;
  baseline_completed_at: string | null;
  /** Years elapsed since MS diagnosis. Set during onboarding. */
  years_since_diagnosis: number | null;
  /** Expanded Disability Status Scale (0–10, step 0.5). Optional. */
  edss_score: number | null;
  /** Patient age (18–65). Set during onboarding. */
  age: number | null;
  /** Height in centimetres. Set during onboarding. */
  height_cm: number | null;
  /** Weight in kilograms. Set during onboarding. */
  weight_kg: number | null;
  /** Highest education level attained. Set during onboarding. */
  education_level: string | null;
  /** Auto-set at signup — serves as enrolled_at for the 84-day baseline countdown. */
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  id: string;
  user_id: string;
  domain: MsDomain;
  test_type: string;
  phase: MonitoringPhase;
  data: Record<string, unknown>;
  device_platform: string | null;
  app_version: string | null;
  created_at: string;
}

export interface PassiveEvent {
  id: string;
  user_id: string;
  event_type: 'keystroke_dynamics' | 'gps_life_space';
  data: Record<string, unknown>;
  collected_at: string;
  created_at: string;
}

// ─── Per-test JSONB data shapes ───────────────────────────────────────────────
// These type the `data` field for each known test_type.

export interface EsdmtData {
  /**
   * IPS (Information Processing Speed) score = number of correct responses
   * in the 90-second window. This is the primary clinical biomarker.
   * Identical to correct_matches for a standard 90s test.
   */
  ips_score: number;
  total_attempts: number;
  correct_matches: number;
  errors: number;
  /** Accuracy percentage (correct / attempts × 100). Secondary metric. */
  score_pct: number;
  duration_seconds: number;
  test_version: string;
}

export interface FingerTappingData {
  total_taps: number;
  frequency_hz: number;
  fatigue_index: number;
  dominant_hand: 'left' | 'right' | null;
  tap_events: Array<{ t: number; side: 'L' | 'R' }>;
  duration_seconds: number;
}

export interface MobilityData {
  u_turn_count: number;
  average_acceleration: number;
  mean_resultant_acceleration_by_second: number[];
  duration_seconds: number;
  sensor_available: boolean;
}

export interface VisionContrastData {
  /**
   * Opacity (0.0–1.0) at which the patient failed 3 consecutive times.
   * Lower value = better contrast sensitivity (could see fainter letters).
   */
  final_contrast_threshold: number;
  total_correct_matches: number;
  total_attempts: number;
  accuracy_pct: number;
  /** Full trial log — enables psychometric curve reconstruction over time. */
  staircase_log: Array<{ opacity: number; correct: boolean }>;
  test_version: string;
}

// ─── Clinical analytics types ─────────────────────────────────────────────────

export interface BaselineStats {
  domain: MsDomain;
  testType: string;
  /** The JSONB field name used as the primary metric (e.g. 'ips_score') */
  metricKey: string;
  mean: number;
  variance: number;
  stdDev: number;
  sampleCount: number;
}

export type TestStatus = 'due' | 'overdue' | 'completed' | 'upcoming';

export interface TestScheduleItem {
  testType: string;
  domain: MsDomain;
  label: string;
  route: string;
  /** Target frequency in days for the current phase */
  intervalDays: number;
  lastCompletedAt: string | null;
  /** Negative value means overdue */
  daysUntilDue: number;
  status: TestStatus;
  nextAvailableAt: string;
}

export type DeclineSeverity = 'none' | 'concern' | 'alert';

export interface DeclineReport {
  domain: MsDomain;
  testType: string;
  metricKey: string;
  baselineMean: number;
  recentMean: number;
  /** Negative = decline (e.g. -0.22 means 22% below baseline) */
  pctChange: number;
  sustainedWeeks: number;
  severity: DeclineSeverity;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  /** ISO date key 'YYYY-MM-DD' of last active day, or null */
  lastActiveDateKey: string | null;
}

export type BadgeType =
  | 'first_test'
  | 'streak_7'
  | 'streak_30'
  | 'baseline_complete'
  | 'all_domains_day'
  | 'sessions_10'
  | 'sessions_50';

export interface Badge {
  type: BadgeType;
  label: string;
  /** Ionicons icon name */
  icon: string;
  description: string;
  earned: boolean;
  earnedAt: string | null;
}

export interface PinchDragData {
  /** Average error distance in pixels from target centre — lower is more precise */
  mean_error_px: number;
  /** Standard deviation of error — measures tremor/variability */
  error_stddev_px: number;
  /** Trials completed in the session */
  trial_count: number;
  /** Median completion time per trial in ms */
  median_time_ms: number;
  /** Number of trials where the drop missed the target entirely */
  miss_count: number;
  /** Accuracy 0–100% (successful drops / total trials × 100) */
  accuracy_pct: number;
  dominant_hand: 'left' | 'right' | null;
  test_version: string;
}

export interface MSIS29Data {
  /**
   * Raw item responses, 1–5 each.
   * items[0]–items[19] = physical subscale (20 items)
   * items[20]–items[28] = psychological subscale (9 items)
   */
  item_responses: number[];
  /** 0–100, higher = more impacted */
  physical_subscale: number;
  /** 0–100, higher = more impacted */
  psychological_subscale: number;
  /** Mean of physical + psychological subscales */
  total_score: number;
  test_version: string;
}

// ─── Per-test JSONB data shapes ───────────────────────────────────────────────

export interface DailyEMAData {
  /** 0–4 ordinal: Very Poor=0, Poor=1, Neutral=2, Good=3, Great=4 */
  mood_index: number;
  /** Normalized 0.0–1.0 (mood_index / 4) */
  mood_normalized: number;
  /** Raw slider value 1–10 */
  energy_level: number;
  /** Normalized 0.0–1.0 ((energy_level - 1) / 9) */
  energy_normalized: number;
  /** Optional free-text symptom note */
  notes: string | null;
  /** ISO timestamp from device clock — enables diurnal fatigue pattern analysis */
  captured_at: string;
  /** Frequency marker — distinguishes daily EMA from 3×/week motor tests */
  frequency: 'daily';
  test_version: string;
}

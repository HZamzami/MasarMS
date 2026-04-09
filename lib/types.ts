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
  ms_phenotype: 'RRMS' | 'SPMS' | 'PPMS' | 'PRMS' | null;
  baseline_completed_at: string | null;
  /** Years elapsed since MS diagnosis. Set during onboarding. */
  years_since_diagnosis: number | null;
  /** Expanded Disability Status Scale (0–10, step 0.5). Optional. */
  edss_score: number | null;
  /** Patient age (18–65). Set during onboarding. */
  age: number | null;
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

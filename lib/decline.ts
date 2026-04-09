import { supabase } from './supabase';
import { getPersonalizedBaseline } from './baseline';
import type { DeclineReport, DeclineSeverity } from './types';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Primary metric key per testType (must match JSONB field names). */
const METRIC_KEYS: Record<string, string> = {
  eSDMT:               'ips_score',
  FingerTapping:       'frequency_hz',
  PinchDrag:           'accuracy_pct',
  '2MWT':              'u_turn_count',
  ContrastSensitivity: 'final_contrast_threshold',
  DailyEMA:            'mood_normalized',
};

/**
 * For contrast sensitivity, a LOWER threshold = BETTER vision, so decline
 * is represented by an INCREASE. All other tests: lower = worse.
 */
const HIGHER_IS_WORSE: Set<string> = new Set(['ContrastSensitivity']);

/** 
 * Section 11.2: Decline must be sustained for ≥12 weeks 
 * to differentiate from temporary fluctuations.
 */
const CONCERN_WEEKS  = 4;
const ALERT_WEEKS    = 12;

/** Relative-change thresholds (expressed as fractions). */
const CONCERN_PCT  = -0.15; // 15% adverse change
const ALERT_PCT    = -0.20; // 20% adverse change (Section 11.1)

// ─── Week-key helper ──────────────────────────────────────────────────────────

/** Returns an ISO week string 'YYYY-Www' for a given Date. */
function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Detects whether a user is showing a sustained decline on a specific test
 * compared to their personalised baseline.
 */
export async function detectDecline(
  userId: string,
  testType: string,
): Promise<DeclineReport | null> {
  const metricKey = METRIC_KEYS[testType];
  if (!metricKey) return null;

  // 1. Fetch baseline stats
  const baseline = await getPersonalizedBaseline(userId, testType, metricKey);
  if (!baseline) return null;

  // 2. Fetch last 120 days of longitudinal results (to ensure we cover the 12-week window)
  const cutoff = new Date(Date.now() - 120 * 86_400_000).toISOString();

  const { data: rows, error } = await supabase
    .from('test_results')
    .select('data, created_at')
    .eq('user_id', userId)
    .eq('test_type', testType)
    .eq('phase', 'longitudinal')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });

  if (error || !rows || rows.length === 0) return null;

  // 3. Group by ISO week, compute weekly means
  const weekBuckets = new Map<string, number[]>();

  for (const row of rows) {
    const raw = (row.data as Record<string, unknown>)[metricKey];
    if (typeof raw !== 'number' || !isFinite(raw)) continue;

    const key = weekKey(new Date(row.created_at as string));
    const bucket = weekBuckets.get(key);
    if (bucket) {
      bucket.push(raw);
    } else {
      weekBuckets.set(key, [raw]);
    }
  }

  if (weekBuckets.size < 2) return null;

  // Sort weeks descending (most recent first)
  const sortedWeeks = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => b.localeCompare(a));

  const weeklyMeans = sortedWeeks.map(([, vals]) =>
    vals.reduce((sum, v) => sum + v, 0) / vals.length
  );

  // 4. Count consecutive adverse weeks from most recent
  const baselineMean = baseline.mean;
  const inverseMetric = HIGHER_IS_WORSE.has(testType);

  // Adverse change = >15% deviation in the "bad" direction
  function isAdverseWeek(weekMean: number): boolean {
    const deviation = (weekMean - baselineMean) / (baselineMean || 1);
    const effectiveDeviation = inverseMetric ? deviation : -deviation;
    return effectiveDeviation <= CONCERN_PCT; 
  }

  let sustainedWeeks = 0;
  for (const wm of weeklyMeans) {
    if (isAdverseWeek(wm)) {
      sustainedWeeks++;
    } else {
      break;
    }
  }

  // 5. Compute pctChange from baseline using the most recent week's mean
  const recentMean = weeklyMeans[0] ?? baselineMean;
  const rawPct = (recentMean - baselineMean) / Math.abs(baselineMean || 1);
  
  // normalizedPct: negative = adverse/decline regardless of metric direction
  const normalizedPct = inverseMetric ? -rawPct : rawPct;

  // 6. Severity classification
  let severity: DeclineSeverity = 'none';
  const adversePct = -normalizedPct; // positive = amount of decline

  if (adversePct >= Math.abs(ALERT_PCT) && sustainedWeeks >= ALERT_WEEKS) {
    severity = 'alert';
  } else if (adversePct >= Math.abs(CONCERN_PCT) && sustainedWeeks >= CONCERN_WEEKS) {
    severity = 'concern';
  }

  return {
    domain: baseline.domain,
    testType,
    metricKey,
    baselineMean,
    recentMean,
    pctChange: normalizedPct,
    sustainedWeeks,
    severity,
  };
}

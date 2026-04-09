import { supabase } from './supabase';
import type { BaselineStats, MsDomain } from './types';

// Maps testType → (domain, primary metric key)
const TEST_META: Record<string, { domain: MsDomain; metricKey: string }> = {
  eSDMT:               { domain: 'cognitive',     metricKey: 'ips_score' },
  FingerTapping:       { domain: 'motor',          metricKey: 'frequency_hz' },
  '2MWT':              { domain: 'mobility',       metricKey: 'u_turn_count' },
  ContrastSensitivity: { domain: 'physiological',  metricKey: 'final_contrast_threshold' },
  DailyEMA:            { domain: 'mood',           metricKey: 'mood_normalized' },
};

/** Minimum samples required before a baseline is considered valid. */
const MIN_SAMPLES = 3;

/**
 * Computes personalised baseline statistics for a specific test using
 * Welford's numerically stable online algorithm.
 *
 * Returns null when the user has fewer than MIN_SAMPLES valid baseline rows
 * (guards against spurious "decline" flags on new accounts).
 */
export async function getPersonalizedBaseline(
  userId: string,
  testType: string,
  metricKey?: string,
): Promise<BaselineStats | null> {
  const meta = TEST_META[testType];
  const key = metricKey ?? meta?.metricKey;
  const domain: MsDomain = meta?.domain ?? 'cognitive';

  if (!key) return null;

  const { data: rows, error } = await supabase
    .from('test_results')
    .select('data')
    .eq('user_id', userId)
    .eq('test_type', testType)
    .eq('phase', 'baseline')
    .order('created_at', { ascending: true });

  if (error || !rows) return null;

  // Welford's online algorithm — O(n), single pass, numerically stable
  let n = 0;
  let mean = 0;
  let M2 = 0;

  for (const row of rows) {
    const raw = (row.data as Record<string, unknown>)[key];
    if (typeof raw !== 'number' || !isFinite(raw)) continue;

    n++;
    const delta = raw - mean;
    mean += delta / n;
    const delta2 = raw - mean;
    M2 += delta * delta2;
  }

  if (n < MIN_SAMPLES) return null;

  const variance = n > 1 ? M2 / (n - 1) : 0;

  return {
    domain,
    testType,
    metricKey: key,
    mean,
    variance,
    stdDev: Math.sqrt(variance),
    sampleCount: n,
  };
}

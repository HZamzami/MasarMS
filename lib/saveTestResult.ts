import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { MsDomain, MonitoringPhase } from './types';

const APP_VERSION = '1.0.0';
const BASELINE_WINDOW_MS = 12 * 7 * 24 * 60 * 60 * 1000; // 84 days in ms

interface SaveOptions {
  domain: MsDomain;
  testType: string;
  data: Record<string, unknown>;
  /**
   * Override the monitoring phase. If omitted, the phase is determined
   * automatically: 'baseline' if the user enrolled < 12 weeks ago,
   * 'longitudinal' otherwise.
   */
  phase?: MonitoringPhase;
}

/**
 * Resolves whether a result belongs to the 12-week induction baseline
 * or the longitudinal monitoring phase, based on the user's profile
 * enrollment date.
 *
 * Falls back to 'longitudinal' if the profile cannot be read.
 */
async function resolvePhase(userId: string): Promise<MonitoringPhase> {
  const { data } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();

  if (!data?.created_at) return 'longitudinal';

  const enrolledAt = new Date(data.created_at).getTime();
  return Date.now() - enrolledAt < BASELINE_WINDOW_MS ? 'baseline' : 'longitudinal';
}

/**
 * Persists a test result to the unified `test_results` table.
 * Automatically determines monitoring phase unless `opts.phase` is supplied.
 * Throws on auth failure or Supabase insert error.
 */
export async function saveTestResult(opts: SaveOptions): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error('No authenticated user found.');

  const phase = opts.phase ?? (await resolvePhase(user.id));

  const { error } = await supabase.from('test_results').insert({
    user_id: user.id,
    domain: opts.domain,
    test_type: opts.testType,
    phase,
    data: opts.data,
    device_platform: Platform.OS,
    app_version: APP_VERSION,
  });

  if (error) throw error;
}

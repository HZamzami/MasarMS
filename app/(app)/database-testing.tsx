import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type SourceResult = {
  source: string;
  rows: Record<string, unknown>[];
  error: string | null;
};

type TestHistoryGroup = {
  testType: string;
  count: number;
  latestRow: Record<string, unknown>;
  runs: Record<string, unknown>[];
};

type RunSummaryMetric = {
  key: string;
  label: string;
  valueText: string;
  numericValue: number | null;
};

type RunSummaryCardData = {
  title: string;
  dateLabel: string;
  mainMetric: RunSummaryMetric;
  secondaryMetrics: RunSummaryMetric[];
};

const HIDDEN_RUN_FIELDS = new Set([
  'id',
  'user_id',
  'domain',
  'test_type',
  'phase',
  'device_platform',
  'app_version',
]);

const DATA_SOURCES = [
  { table: 'profiles', title: 'About You' },
  { table: 'test_results', title: 'Your Test History' },
  { table: 'passive_events', title: 'Background Data' },
] as const;

function getErrorText(error: unknown) {
  if (!error) return 'Unknown problem';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown problem';
}

function simpleLabel(input: string) {
  return input.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function simpleValue(value: unknown) {
  if (value === null) return 'nothing';
  if (value === undefined) return 'nothing';
  if (typeof value === 'string') return value.length > 40 ? `${value.slice(0, 40)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} things`;
  if (typeof value === 'object') return 'extra details';
  return 'extra details';
}

function formatDateForDisplay(value: unknown) {
  if (typeof value !== 'string') return simpleValue(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const rawHours = date.getHours();
  const hours12 = rawHours % 12 || 12;
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const amPm = rawHours >= 12 ? 'PM' : 'AM';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);

  return `${hours12.toString().padStart(2, '0')}:${minutes} ${amPm} ${day}/${month}/${year}`;
}

function normalizeTestType(testType: string) {
  return testType.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isFingerTappingTest(testType: string) {
  const normalized = normalizeTestType(testType);
  return normalized.includes('fingertapping') || normalized.includes('motortapping');
}

function isEsdmtTest(testType: string) {
  const normalized = normalizeTestType(testType);
  return normalized.includes('esdmt') || normalized.includes('esmdt');
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getNumberByKeys(record: Record<string, unknown> | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const candidate = toFiniteNumber(record[key]);
    if (candidate !== null) return candidate;
  }
  return null;
}

function inferTapCountFromEvents(record: Record<string, unknown> | null): number | null {
  if (!record) return null;
  const events = record.tap_events ?? record.tapEvents;
  if (Array.isArray(events)) return events.length;
  return null;
}

function formatMetricValue(value: unknown) {
  const numeric = toFiniteNumber(value);
  if (numeric !== null) {
    if (Math.abs(numeric) >= 100 || Number.isInteger(numeric)) {
      return { valueText: String(Math.round(numeric)), numericValue: numeric };
    }
    return { valueText: numeric.toFixed(2), numericValue: numeric };
  }
  if (typeof value === 'boolean') {
    return { valueText: value ? 'Yes' : 'No', numericValue: null };
  }
  return { valueText: simpleValue(value), numericValue: null };
}

function buildGeneralRunSummary(testType: string, run: Record<string, unknown>): RunSummaryCardData {
  const nestedData = asObject(run.data);
  const topLevel = asObject(run);
  const rawEntries: [string, unknown][] = [];

  for (const [key, value] of Object.entries(run)) {
    if (HIDDEN_RUN_FIELDS.has(key)) continue;
    if (key === 'created_at' || key === 'data') continue;
    rawEntries.push([key, value]);
  }

  if (nestedData) {
    for (const [key, value] of Object.entries(nestedData)) {
      if (key === 'tap_events' || key === 'tapEvents') continue;
      if (rawEntries.some(([existing]) => existing === key)) continue;
      rawEntries.push([key, value]);
    }
  }

  let metrics: RunSummaryMetric[] = rawEntries.map(([key, value]) => {
    const formatted = formatMetricValue(value);
    return {
      key,
      label: displayFieldLabel(key),
      valueText: formatted.valueText,
      numericValue: formatted.numericValue,
    };
  }).filter((metric) => metric.valueText !== 'extra details');

  if (isEsdmtTest(testType)) {
    const scorePct =
      getNumberByKeys(topLevel, ['score_pct', 'scorePct']) ??
      getNumberByKeys(nestedData, ['score_pct', 'scorePct']);
    const correctMatches =
      getNumberByKeys(topLevel, ['correct_matches', 'correctMatches']) ??
      getNumberByKeys(nestedData, ['correct_matches', 'correctMatches']);

    metrics = metrics.map((metric) => {
      const normalizedKey = normalizeTestType(metric.key);
      if ((normalizedKey === 'durationseconds' || normalizedKey === 'duration') && scorePct !== null) {
        return {
          ...metric,
          label: 'Score %',
          valueText: `${Math.round(scorePct)}%`,
          numericValue: scorePct,
        };
      }
      if (normalizedKey === 'ipsscore' && correctMatches !== null) {
        return {
          ...metric,
          label: 'Correct Matches',
          valueText: String(Math.round(correctMatches)),
          numericValue: correctMatches,
        };
      }
      return metric;
    });
  }

  const preferredMainKeys = [
    'score',
    'accuracy',
    'u_turn_count',
    'average_acceleration',
    'frequency_hz',
    'fatigue_index',
    'duration_seconds',
    'total_attempts',
    'correct_matches',
  ];

  let mainMetric =
    preferredMainKeys
      .map((key) => metrics.find((metric) => normalizeTestType(metric.key) === normalizeTestType(key)))
      .find((metric) => metric && metric.numericValue !== null) ?? null;

  if (!mainMetric) {
    mainMetric = metrics.find((metric) => metric.numericValue !== null) ?? metrics[0] ?? {
      key: 'run',
      label: 'Run',
      valueText: '--',
      numericValue: null,
    };
  }

  const secondaryMetrics = metrics
    .filter((metric) => metric.key !== mainMetric.key)
    .slice(0, 2);

  while (secondaryMetrics.length < 2) {
    secondaryMetrics.push({
      key: `placeholder-${secondaryMetrics.length}`,
      label: secondaryMetrics.length === 0 ? 'Status' : 'Detail',
      valueText: '--',
      numericValue: null,
    });
  }

  return {
    title: `${simpleLabel(testType)} Result`,
    dateLabel: formatDateForDisplay(run.created_at),
    mainMetric,
    secondaryMetrics,
  };
}

function getFingerTappingMetrics(run: Record<string, unknown>) {
  const nestedData = asObject(run.data);
  const topLevel = asObject(run);

  const totalTaps =
    getNumberByKeys(topLevel, ['total_taps', 'totalTaps']) ??
    getNumberByKeys(nestedData, ['total_taps', 'totalTaps']) ??
    inferTapCountFromEvents(topLevel) ??
    inferTapCountFromEvents(nestedData) ??
    0;

  const frequencyHz =
    getNumberByKeys(topLevel, ['frequency_hz', 'frequencyHz']) ??
    getNumberByKeys(nestedData, ['frequency_hz', 'frequencyHz']) ??
    totalTaps / 10;

  const fatigueIndex =
    getNumberByKeys(topLevel, ['fatigue_index', 'fatigueIndex']) ??
    getNumberByKeys(nestedData, ['fatigue_index', 'fatigueIndex']);

  const barPercent = Math.max(0, Math.min(100, Math.round((totalTaps / 120) * 100)));

  return {
    totalTaps: Math.max(0, Math.round(totalTaps)),
    frequencyHz,
    fatigueIndex,
    barPercent,
    dateLabel: formatDateForDisplay(run.created_at),
  };
}

function displayFieldLabel(key: string) {
  if (key === 'created_at') return 'Date';
  return simpleLabel(key);
}

export default function DatabaseTestingScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authProblem, setAuthProblem] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [results, setResults] = useState<SourceResult[]>([]);

  const loadData = useCallback(async () => {
    setAuthProblem(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setAuthProblem(getErrorText(userError));
      setResults([]);
      return;
    }
    if (!user) {
      setAuthProblem('I could not find a signed-in user.');
      setResults([]);
      return;
    }

    const pulls = DATA_SOURCES.map(async (source) => {
      const { data, error } = await supabase
        .from(source.table)
        .select('*')
        .limit(200);

      return {
        source: source.table,
        rows: Array.isArray(data) ? (data as Record<string, unknown>[]) : [],
        error: error ? getErrorText(error) : null,
      } satisfies SourceResult;
    });

    const pulled = await Promise.all(pulls);
    setResults(pulled);
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        await loadData();
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const totalItems = useMemo(
    () => results.reduce((sum, item) => sum + item.rows.length, 0),
    [results],
  );

  const testHistoryGroups = useMemo(() => {
    const testHistorySource = results.find((entry) => entry.source === 'test_results');
    if (!testHistorySource || testHistorySource.rows.length === 0) return [] as TestHistoryGroup[];

    const groups = new Map<string, TestHistoryGroup>();

    for (const row of testHistorySource.rows) {
      const rawTestType = row.test_type;
      const testType = typeof rawTestType === 'string' && rawTestType.length > 0
        ? rawTestType
        : 'Unknown Test';

      const existing = groups.get(testType);
      if (!existing) {
        groups.set(testType, {
          testType,
          count: 1,
          latestRow: row,
          runs: [row],
        });
        continue;
      }

      existing.count += 1;
      existing.runs.push(row);

      const existingDate = typeof existing.latestRow.created_at === 'string'
        ? new Date(existing.latestRow.created_at).getTime()
        : Number.NEGATIVE_INFINITY;
      const incomingDate = typeof row.created_at === 'string'
        ? new Date(row.created_at).getTime()
        : Number.NEGATIVE_INFINITY;

      if (incomingDate > existingDate) {
        existing.latestRow = row;
      }
    }

    for (const group of groups.values()) {
      group.runs.sort((a, b) => {
        const aTime = typeof a.created_at === 'string' ? new Date(a.created_at).getTime() : Number.NEGATIVE_INFINITY;
        const bTime = typeof b.created_at === 'string' ? new Date(b.created_at).getTime() : Number.NEGATIVE_INFINITY;
        return bTime - aTime;
      });
    }

    return Array.from(groups.values()).sort((a, b) => a.testType.localeCompare(b.testType));
  }, [results]);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 pt-4 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={20}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color="#006880" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-primary">Database Testing</Text>
        </View>
        <TouchableOpacity
          className="px-3 py-2 rounded-full bg-primary"
          onPress={() => void onRefresh()}
          accessibilityRole="button"
          accessibilityLabel="Refresh data"
        >
          <Text className="text-on-primary text-xs font-semibold">Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <View className="bg-surface-container-low rounded-2xl p-4 mb-4">
          <Text className="text-on-surface text-base font-bold">Simple Data View</Text>
          <Text className="text-on-surface-variant text-xs mt-1">
            I checked {DATA_SOURCES.length} data places.
          </Text>
          <Text className="text-on-surface-variant text-xs">
            I found {totalItems} saved things in total.
          </Text>
          <Text className="text-on-surface-variant text-xs">
            Last check: {lastChecked ? lastChecked.toLocaleString() : 'not yet'}
          </Text>
          {loading ? (
            <Text className="text-primary text-sm mt-2">Looking for your data...</Text>
          ) : null}
          {authProblem ? (
            <Text className="text-error text-xs mt-2">{authProblem}</Text>
          ) : null}
        </View>

        {DATA_SOURCES.map((sourceMeta) => {
          const sourceResult = results.find((entry) => entry.source === sourceMeta.table);
          const rowCount = sourceResult?.rows.length ?? 0;
          const firstRow = rowCount > 0 ? sourceResult?.rows[0] : null;
          const previewFields = firstRow
            ? Object.entries(firstRow)
              .filter(([key]) => key !== 'id' && key !== 'user_id')
              .slice(0, 3)
            : [];

          if (sourceMeta.table === 'test_results') {
            if (sourceResult?.error) {
              return (
                <View key={sourceMeta.table} className="bg-surface-container-low rounded-2xl p-4 mb-3">
                  <Text className="text-on-surface font-bold text-base">Test Results</Text>
                  <Text className="text-error text-xs mt-2">
                    I could not read this part right now: {sourceResult.error}
                  </Text>
                </View>
              );
            }

            if (testHistoryGroups.length === 0) {
              return (
                <View key={sourceMeta.table} className="bg-surface-container-low rounded-2xl p-4 mb-3">
                  <Text className="text-on-surface font-bold text-base">Test Results</Text>
                  <Text className="text-on-surface-variant text-xs mt-1">
                    No saved test runs yet.
                  </Text>
                </View>
              );
            }

            return (
              <View key={sourceMeta.table} className="mb-3" style={{ gap: 8 }}>
                {testHistoryGroups.map((group) => (
                  <View key={`${sourceMeta.table}-${group.testType}`} className="bg-surface-container-low rounded-2xl p-4">
                    <Text className="text-on-surface font-bold text-base">
                      {simpleLabel(group.testType)}
                    </Text>

                    <View className="mt-2" style={{ gap: 8 }}>
                      {group.runs.map((run, runIndex) => (
                        (() => {
                          const isFinger = isFingerTappingTest(group.testType);
                          const fingerMetrics = isFinger ? getFingerTappingMetrics(run) : null;
                          const genericSummary = !isFinger ? buildGeneralRunSummary(group.testType, run) : null;

                          const titleText = isFinger
                            ? `Finger Tapping Run ${runIndex + 1}`
                            : `Run ${runIndex + 1}`;
                          const dateLabel = isFinger
                            ? fingerMetrics?.dateLabel ?? '--'
                            : genericSummary?.dateLabel ?? '--';

                          const mainLabel = isFinger
                            ? 'Total Taps'
                            : genericSummary?.mainMetric.label ?? 'Result';
                          const mainValue = isFinger
                            ? String(fingerMetrics?.totalTaps ?? 0)
                            : genericSummary?.mainMetric.valueText ?? '--';

                          const secondaryCards = isFinger
                            ? [
                              {
                                label: 'Frequency',
                                value: `${(fingerMetrics?.frequencyHz ?? 0).toFixed(2)} Hz`,
                              },
                              {
                                label: 'Fatigue Index',
                                value: fingerMetrics?.fatigueIndex === null || fingerMetrics?.fatigueIndex === undefined
                                  ? '--'
                                  : fingerMetrics.fatigueIndex.toFixed(2),
                              },
                            ]
                            : [
                              {
                                label: genericSummary?.secondaryMetrics[0]?.label ?? 'Status',
                                value: genericSummary?.secondaryMetrics[0]?.valueText ?? '--',
                              },
                              {
                                label: genericSummary?.secondaryMetrics[1]?.label ?? 'Detail',
                                value: genericSummary?.secondaryMetrics[1]?.valueText ?? '--',
                              },
                            ];

                          return (
                            <View
                              key={`${group.testType}-run-${runIndex}`}
                              className="bg-surface-container-lowest rounded-[24px] p-4"
                              style={{
                                shadowColor: '#2b3438',
                                shadowOpacity: 0.05,
                                shadowRadius: 20,
                                elevation: 4,
                              }}
                            >
                              <View className="flex-row items-center justify-between mb-3">
                                <Text className="text-primary text-[11px] uppercase tracking-[1.2px] font-bold">
                                  {titleText}
                                </Text>
                                <Text className="text-on-surface-variant text-xs font-semibold">
                                  {dateLabel}
                                </Text>
                              </View>

                              <View className="bg-surface-container-low rounded-2xl px-4 py-3 mb-3">
                                <Text className="text-on-surface-variant text-xs font-semibold">
                                  {mainLabel}
                                </Text>
                                <Text className="text-on-surface text-[48px] leading-[50px] font-extrabold mt-1">
                                  {mainValue}
                                </Text>
                              </View>

                              <View className="flex-row" style={{ gap: 8 }}>
                                {secondaryCards.map((card, cardIndex) => (
                                  <View
                                    key={`${group.testType}-run-${runIndex}-mini-${cardIndex}`}
                                    className="flex-1 bg-surface-container-low rounded-xl p-3"
                                  >
                                    <Text className="text-on-surface-variant text-[11px] uppercase tracking-[1px] font-bold">
                                      {card.label}
                                    </Text>
                                    <Text className="text-on-surface text-base font-bold mt-1">
                                      {card.value}
                                    </Text>
                                  </View>
                                ))}
                              </View>

                              <View className="mt-3">
                                <View className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                                  <View
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: '100%' }}
                                  />
                                </View>
                              </View>
                            </View>
                          );
                        })()
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            );
          }

          return (
            <View key={sourceMeta.table} className="bg-surface-container-low rounded-2xl p-4 mb-3">
              <Text className="text-on-surface font-bold text-base">{sourceMeta.title}</Text>

              {sourceResult?.error ? (
                <Text className="text-error text-xs mt-2">
                  I could not read this part right now: {sourceResult.error}
                </Text>
              ) : (
                <>
                  {previewFields.length > 0 ? (
                    <View className="bg-surface-container-lowest rounded-xl p-3 mt-2">
                      <Text className="text-on-surface text-xs font-semibold mb-1">
                        Latest item says:
                      </Text>
                      {previewFields.map(([key, value]) => (
                        <Text key={`${sourceMeta.table}-${key}`} className="text-on-surface-variant text-xs">
                          {displayFieldLabel(key)}: {key === 'created_at' ? formatDateForDisplay(value) : simpleValue(value)}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

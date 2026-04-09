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
import { useLocalization } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';

type SourceResult = {
  source: string;
  rows: Record<string, unknown>[];
  error: string | null;
};

type TestHistoryGroup = {
  testType: string;
  runs: Record<string, unknown>[];
};

type RunSummaryMetric = {
  key: string;
  label: string;
  valueText: string;
  numericValue: number | null;
};

type RunSummaryCardData = {
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
  { table: 'profiles', titleKey: 'aboutYou' },
  { table: 'test_results', titleKey: 'yourTestHistory' },
  { table: 'passive_events', titleKey: 'backgroundData' },
] as const;

function getErrorText(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function simpleLabel(input: string) {
  return input.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function simpleValue(value: unknown, messages: ReturnType<typeof useLocalization>['messages']) {
  if (value === null || value === undefined) return messages.databaseTesting.nothing;
  if (typeof value === 'string') return value.length > 40 ? `${value.slice(0, 40)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} ${messages.databaseTesting.things}`;
  if (typeof value === 'object') return messages.databaseTesting.extraDetails;
  return messages.databaseTesting.extraDetails;
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

function displayFieldLabel(key: string) {
  if (key === 'created_at') return 'Date';
  return simpleLabel(key);
}

function formatMetricValue(value: unknown, messages: ReturnType<typeof useLocalization>['messages']) {
  const numeric = toFiniteNumber(value);
  if (numeric !== null) {
    if (Math.abs(numeric) >= 100 || Number.isInteger(numeric)) {
      return { valueText: String(Math.round(numeric)), numericValue: numeric };
    }
    return { valueText: numeric.toFixed(2), numericValue: numeric };
  }
  if (typeof value === 'boolean') {
    return { valueText: value ? messages.databaseTesting.yes : messages.databaseTesting.no, numericValue: null };
  }
  return { valueText: simpleValue(value, messages), numericValue: null };
}

export default function DatabaseTestingScreen() {
  const router = useRouter();
  const {
    backIcon,
    formatMessage,
    formatNumber,
    locale,
    messages,
    row,
    textAlign,
    translateTestType,
  } = useLocalization();

  const formatDateForDisplay = useCallback((value: unknown) => {
    if (typeof value !== 'string') return simpleValue(value, messages);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(locale);
  }, [locale, messages]);

  const buildGeneralRunSummary = useCallback((testType: string, run: Record<string, unknown>): RunSummaryCardData => {
    const nestedData = asObject(run.data);
    const rawEntries: [string, unknown][] = [];

    for (const [key, value] of Object.entries(run)) {
      if (HIDDEN_RUN_FIELDS.has(key) || key === 'created_at' || key === 'data') continue;
      rawEntries.push([key, value]);
    }

    if (nestedData) {
      for (const [key, value] of Object.entries(nestedData)) {
        if (key === 'tap_events' || key === 'tapEvents') continue;
        if (rawEntries.some(([existingKey]) => existingKey === key)) continue;
        rawEntries.push([key, value]);
      }
    }

    let metrics: RunSummaryMetric[] = rawEntries
      .map(([key, value]) => {
        const formatted = formatMetricValue(value, messages);
        return {
          key,
          label: displayFieldLabel(key),
          valueText: formatted.valueText,
          numericValue: formatted.numericValue,
        };
      })
      .filter((metric) => metric.valueText !== messages.databaseTesting.extraDetails);

    if (isEsdmtTest(testType)) {
      const scorePct =
        getNumberByKeys(asObject(run), ['score_pct', 'scorePct']) ??
        getNumberByKeys(nestedData, ['score_pct', 'scorePct']);
      const correctMatches =
        getNumberByKeys(asObject(run), ['correct_matches', 'correctMatches']) ??
        getNumberByKeys(nestedData, ['correct_matches', 'correctMatches']);

      metrics = metrics.map((metric) => {
        const normalizedKey = normalizeTestType(metric.key);
        if ((normalizedKey === 'durationseconds' || normalizedKey === 'duration') && scorePct !== null) {
          return { ...metric, label: 'Score %', valueText: `${Math.round(scorePct)}%`, numericValue: scorePct };
        }
        if (normalizedKey === 'ipsscore' && correctMatches !== null) {
          return { ...metric, label: messages.results.correct, valueText: String(Math.round(correctMatches)), numericValue: correctMatches };
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
        label: messages.databaseTesting.result,
        valueText: '--',
        numericValue: null,
      };
    }

    const secondaryMetrics = metrics.filter((metric) => metric.key !== mainMetric.key).slice(0, 2);
    while (secondaryMetrics.length < 2) {
      secondaryMetrics.push({
        key: `placeholder-${secondaryMetrics.length}`,
        label: secondaryMetrics.length === 0 ? messages.databaseTesting.status : messages.databaseTesting.detail,
        valueText: '--',
        numericValue: null,
      });
    }

    return {
      dateLabel: formatDateForDisplay(run.created_at),
      mainMetric,
      secondaryMetrics,
    };
  }, [formatDateForDisplay, messages]);

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
      setAuthProblem(getErrorText(userError, messages.databaseTesting.unknownProblem));
      setResults([]);
      return;
    }
    if (!user) {
      setAuthProblem(messages.databaseTesting.noSignedInUser);
      setResults([]);
      return;
    }

    const pulls = DATA_SOURCES.map(async (source) => {
      const { data, error } = await supabase.from(source.table).select('*').limit(200);
      return {
        source: source.table,
        rows: Array.isArray(data) ? (data as Record<string, unknown>[]) : [],
        error: error ? getErrorText(error, messages.databaseTesting.unknownProblem) : null,
      } satisfies SourceResult;
    });

    setResults(await Promise.all(pulls));
    setLastChecked(new Date());
  }, [messages]);

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
      const testType = typeof rawTestType === 'string' && rawTestType.length > 0 ? rawTestType : 'Unknown Test';
      const existing = groups.get(testType);
      if (!existing) {
        groups.set(testType, { testType, runs: [row] });
        continue;
      }
      existing.runs.push(row);
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
      <View className="px-6 pt-4 pb-3 items-center justify-between" style={row}>
        <View className="items-center" style={row}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={20}
            accessibilityRole="button"
            accessibilityLabel={messages.common.back}
          >
            <Ionicons name={backIcon} size={24} color="#006880" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-primary" style={{ marginStart: 10 }}>
            {messages.databaseTesting.title}
          </Text>
        </View>
        <TouchableOpacity
          className="px-3 py-2 rounded-full bg-primary"
          onPress={() => void onRefresh()}
          accessibilityRole="button"
          accessibilityLabel={messages.common.refresh}
        >
          <Text className="text-on-primary text-xs font-semibold">{messages.common.refresh}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <View className="bg-surface-container-low rounded-2xl p-4 mb-4">
          <Text className="text-on-surface text-base font-bold" style={textAlign}>
            {messages.databaseTesting.simpleDataView}
          </Text>
          <Text className="text-on-surface-variant text-xs mt-1" style={textAlign}>
            {formatMessage(messages.databaseTesting.checkedPlaces, { count: formatNumber(DATA_SOURCES.length) })}
          </Text>
          <Text className="text-on-surface-variant text-xs" style={textAlign}>
            {formatMessage(messages.databaseTesting.foundThings, { count: formatNumber(totalItems) })}
          </Text>
          <Text className="text-on-surface-variant text-xs" style={textAlign}>
            {formatMessage(messages.databaseTesting.lastCheck, {
              value: lastChecked ? lastChecked.toLocaleString(locale) : messages.databaseTesting.notYet,
            })}
          </Text>
          {loading ? <Text className="text-primary text-sm mt-2">{messages.databaseTesting.looking}</Text> : null}
          {authProblem ? <Text className="text-error text-xs mt-2">{authProblem}</Text> : null}
        </View>

        {DATA_SOURCES.map((sourceMeta) => {
          const sourceResult = results.find((entry) => entry.source === sourceMeta.table);
          const sourceTitle = messages.databaseTesting[sourceMeta.titleKey];
          const firstRow = sourceResult?.rows[0];
          const previewFields = firstRow
            ? Object.entries(firstRow).filter(([key]) => key !== 'id' && key !== 'user_id').slice(0, 3)
            : [];

          if (sourceMeta.table === 'test_results') {
            if (sourceResult?.error) {
              return (
                <View key={sourceMeta.table} className="bg-surface-container-low rounded-2xl p-4 mb-3">
                  <Text className="text-on-surface font-bold text-base">{messages.databaseTesting.testResults}</Text>
                  <Text className="text-error text-xs mt-2">
                    {formatMessage(messages.databaseTesting.couldNotReadPart, { error: sourceResult.error })}
                  </Text>
                </View>
              );
            }

            if (testHistoryGroups.length === 0) {
              return (
                <View key={sourceMeta.table} className="bg-surface-container-low rounded-2xl p-4 mb-3">
                  <Text className="text-on-surface font-bold text-base">{messages.databaseTesting.testResults}</Text>
                  <Text className="text-on-surface-variant text-xs mt-1">{messages.databaseTesting.noSavedRuns}</Text>
                </View>
              );
            }

            return (
              <View key={sourceMeta.table} className="mb-3" style={{ gap: 8 }}>
                {testHistoryGroups.map((group) => (
                  <View key={`${sourceMeta.table}-${group.testType}`} className="bg-surface-container-low rounded-2xl p-4">
                    <Text className="text-on-surface font-bold text-base">
                      {translateTestType(group.testType)}
                    </Text>

                    <View className="mt-2" style={{ gap: 8 }}>
                      {group.runs.map((run, runIndex) => {
                        const isFinger = isFingerTappingTest(group.testType);
                        const fingerMetrics = isFinger
                          ? {
                            totalTaps:
                              getNumberByKeys(asObject(run), ['total_taps', 'totalTaps']) ??
                              getNumberByKeys(asObject(run.data), ['total_taps', 'totalTaps']) ??
                              inferTapCountFromEvents(asObject(run)) ??
                              inferTapCountFromEvents(asObject(run.data)) ??
                              0,
                            frequencyHz:
                              getNumberByKeys(asObject(run), ['frequency_hz', 'frequencyHz']) ??
                              getNumberByKeys(asObject(run.data), ['frequency_hz', 'frequencyHz']) ??
                              0,
                            fatigueIndex:
                              getNumberByKeys(asObject(run), ['fatigue_index', 'fatigueIndex']) ??
                              getNumberByKeys(asObject(run.data), ['fatigue_index', 'fatigueIndex']),
                            dateLabel: formatDateForDisplay(run.created_at),
                          }
                          : null;
                        const genericSummary = !isFinger ? buildGeneralRunSummary(group.testType, run) : null;

                        const secondaryCards = isFinger
                          ? [
                            {
                              label: messages.databaseTesting.frequency,
                              value: `${(fingerMetrics?.frequencyHz ?? 0).toFixed(2)} Hz`,
                            },
                            {
                              label: messages.databaseTesting.fatigueIndex,
                              value: fingerMetrics?.fatigueIndex === null || fingerMetrics?.fatigueIndex === undefined
                                ? '--'
                                : fingerMetrics.fatigueIndex.toFixed(2),
                            },
                          ]
                          : [
                            {
                              label: genericSummary?.secondaryMetrics[0]?.label ?? messages.databaseTesting.status,
                              value: genericSummary?.secondaryMetrics[0]?.valueText ?? '--',
                            },
                            {
                              label: genericSummary?.secondaryMetrics[1]?.label ?? messages.databaseTesting.detail,
                              value: genericSummary?.secondaryMetrics[1]?.valueText ?? '--',
                            },
                          ];

                        return (
                          <View
                            key={`${group.testType}-run-${runIndex}`}
                            className="bg-surface-container-lowest rounded-[24px] p-4"
                            style={{ shadowColor: '#2b3438', shadowOpacity: 0.05, shadowRadius: 20, elevation: 4 }}
                          >
                            <View className="items-center justify-between mb-3" style={row}>
                              <Text className="text-primary text-[11px] uppercase tracking-[1.2px] font-bold">
                                {isFinger
                                  ? formatMessage(messages.databaseTesting.fingerRun, { index: formatNumber(runIndex + 1) })
                                  : formatMessage(messages.databaseTesting.run, { index: formatNumber(runIndex + 1) })}
                              </Text>
                              <Text className="text-on-surface-variant text-xs font-semibold">
                                {isFinger ? fingerMetrics?.dateLabel ?? '--' : genericSummary?.dateLabel ?? '--'}
                              </Text>
                            </View>

                            <View className="bg-surface-container-low rounded-2xl px-4 py-3 mb-3">
                              <Text className="text-on-surface-variant text-xs font-semibold">
                                {isFinger ? messages.databaseTesting.totalTaps : genericSummary?.mainMetric.label ?? messages.databaseTesting.result}
                              </Text>
                              <Text className="text-on-surface text-[48px] leading-[50px] font-extrabold mt-1">
                                {isFinger ? formatNumber(Math.round(fingerMetrics?.totalTaps ?? 0)) : genericSummary?.mainMetric.valueText ?? '--'}
                              </Text>
                            </View>

                            <View style={[row, { gap: 8 }]}>
                              {secondaryCards.map((card, cardIndex) => (
                                <View
                                  key={`${group.testType}-run-${runIndex}-mini-${cardIndex}`}
                                  className="flex-1 bg-surface-container-low rounded-xl p-3"
                                >
                                  <Text className="text-on-surface-variant text-[11px] uppercase tracking-[1px] font-bold">
                                    {card.label}
                                  </Text>
                                  <Text className="text-on-surface text-base font-bold mt-1">{card.value}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            );
          }

          return (
            <View key={sourceMeta.table} className="bg-surface-container-low rounded-2xl p-4 mb-3">
              <Text className="text-on-surface font-bold text-base">{sourceTitle}</Text>

              {sourceResult?.error ? (
                <Text className="text-error text-xs mt-2">
                  {formatMessage(messages.databaseTesting.couldNotReadPart, { error: sourceResult.error })}
                </Text>
              ) : previewFields.length > 0 ? (
                <View className="bg-surface-container-lowest rounded-xl p-3 mt-2">
                  <Text className="text-on-surface text-xs font-semibold mb-1">
                    {messages.databaseTesting.latestItemSays}
                  </Text>
                  {previewFields.map(([key, value]) => (
                    <Text key={`${sourceMeta.table}-${key}`} className="text-on-surface-variant text-xs">
                      {displayFieldLabel(key)}: {key === 'created_at' ? formatDateForDisplay(value) : simpleValue(value, messages)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

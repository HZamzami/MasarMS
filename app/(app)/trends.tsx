import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocalization } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataPoint {
  value: number;
  date: string; // ISO
}

interface DomainTrend {
  testType: string;
  label: string;
  unit: string;
  points: DataPoint[];
  /** Higher is better for this metric? */
  higherIsBetter: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TREND_CONFIGS: {
  testType: string;
  label: string;
  metricKey: string;
  unit: string;
  higherIsBetter: boolean;
  transform?: (v: number) => number;
}[] = [
  { testType: 'eSDMT',               label: 'eSDMT',               metricKey: 'ips_score',                unit: 'pts', higherIsBetter: true  },
  { testType: 'FingerTapping',       label: 'FingerTapping',       metricKey: 'frequency_hz',             unit: 'Hz',  higherIsBetter: true  },
  { testType: 'PinchDrag',           label: 'PinchDrag',           metricKey: 'accuracy_pct',             unit: '%',   higherIsBetter: true  },
  { testType: '2MWT',                label: '2MWT',                metricKey: 'u_turn_count',             unit: 'turns', higherIsBetter: true },
  { testType: 'ContrastSensitivity', label: 'ContrastSensitivity', metricKey: 'final_contrast_threshold', unit: '%',   higherIsBetter: false,
    transform: (v) => Math.round((1 - v) * 100) },
  { testType: 'DailyEMA',            label: 'DailyEMA',            metricKey: 'energy_level',             unit: '/10', higherIsBetter: true  },
  { testType: 'MSIS29',              label: 'MSIS29',              metricKey: 'total_score',              unit: '/100', higherIsBetter: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trendArrow(points: DataPoint[], higherIsBetter: boolean): {
  icon: 'trending-up' | 'trending-down' | 'remove';
  color: string;
} {
  if (points.length < 2) return { icon: 'remove', color: '#aab3b8' };

  const recent = points.slice(-3).map((p) => p.value);
  const earlier = points.slice(0, 3).map((p) => p.value);

  const recentMean  = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierMean = earlier.reduce((a, b) => a + b, 0) / earlier.length;

  const pctChange = (recentMean - earlierMean) / Math.abs(earlierMean || 1);

  if (Math.abs(pctChange) < 0.05) return { icon: 'remove', color: '#aab3b8' };

  const improving = higherIsBetter ? pctChange > 0 : pctChange < 0;
  return {
    icon: pctChange > 0 ? 'trending-up' : 'trending-down',
    color: improving ? '#006b60' : '#a83836',
  };
}

// ─── MiniBarChart ─────────────────────────────────────────────────────────────

const CHART_HEIGHT = 52;
const CHART_BARS   = 12; // show last N points

function MiniBarChart({
  points,
  higherIsBetter,
}: {
  points: DataPoint[];
  higherIsBetter: boolean;
}) {
  if (points.length === 0) {
    return (
      <View style={{ height: CHART_HEIGHT }} className="items-center justify-center">
        <Text className="text-xs text-on-surface-variant">No data yet</Text>
      </View>
    );
  }

  const values  = points.map((p) => p.value);
  const max     = Math.max(...values);
  const min     = Math.min(...values);
  const range   = max - min || 1;

  // Colour last bar based on whether it's above/below the mean of older bars
  const olderMean = values.slice(0, -1).reduce((a, b) => a + b, 0) / (values.length - 1 || 1);
  const lastVal   = values[values.length - 1];
  const lastImproving = higherIsBetter ? lastVal >= olderMean : lastVal <= olderMean;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 3 }}>
      {points.slice(-CHART_BARS).map((p, i, arr) => {
        const isLast = i === arr.length - 1;
        const barH   = Math.max(6, ((p.value - min) / range) * (CHART_HEIGHT - 8) + 4);
        const color  = isLast
          ? (lastImproving ? '#006b60' : '#a83836')
          : '#006880';
        const opacity = isLast ? 1 : 0.25 + (i / arr.length) * 0.55;

        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: barH,
              backgroundColor: color,
              borderRadius: 3,
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── TrendCard ────────────────────────────────────────────────────────────────

function TrendCard({
  trend,
  onPress,
  formatShortDate,
  emptyLabel,
  readingsLabel,
  accessibilityLabel,
}: {
  trend: DomainTrend;
  onPress: () => void;
  formatShortDate: (value: string) => string;
  emptyLabel: string;
  readingsLabel: (count: number) => string;
  accessibilityLabel: string;
}) {
  const latest   = trend.points[trend.points.length - 1];
  const arrow    = trendArrow(trend.points, trend.higherIsBetter);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface-container-lowest rounded-3xl p-5 mb-3"
      style={{
        shadowColor: '#2b3438',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View className="flex-row items-start justify-between mb-4">
        <View>
          <Text className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">
            {trend.label}
          </Text>
          {latest ? (
            <View className="flex-row items-baseline" style={{ gap: 4 }}>
              <Text className="font-extrabold text-on-surface" style={{ fontSize: 28, lineHeight: 32 }}>
                {latest.value}
              </Text>
              <Text className="text-sm font-bold text-on-surface-variant">{trend.unit}</Text>
            </View>
          ) : (
            <Text className="text-on-surface-variant font-medium">{emptyLabel}</Text>
          )}
        </View>

        <View className="flex-row items-center" style={{ gap: 6 }}>
          {latest && (
            <Text className="text-xs text-on-surface-variant">
              {formatShortDate(latest.date)}
            </Text>
          )}
          <Ionicons name={arrow.icon} size={20} color={arrow.color} />
        </View>
      </View>

      <MiniBarChart points={trend.points} higherIsBetter={trend.higherIsBetter} />

      {trend.points.length >= 2 && (
        <Text className="text-xs text-on-surface-variant mt-3">
          {readingsLabel(trend.points.length)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── TrendsScreen ─────────────────────────────────────────────────────────────

export default function TrendsScreen() {
  const { formatDate, formatMessage, messages, textAlign } = useLocalization();
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<DomainTrend[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadTrends() {
        setLoading(true);
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user || !active) return;

          const testTypes = TREND_CONFIGS.map((c) => c.testType);

          const { data: rows } = await supabase
            .from('test_results')
            .select('test_type, data, created_at')
            .eq('user_id', user.id)
            .in('test_type', testTypes)
            .order('created_at', { ascending: true })
            .limit(500);

          if (!rows || !active) return;

          const built: DomainTrend[] = TREND_CONFIGS.map((cfg) => {
            const typeRows = rows.filter((r) => r.test_type === cfg.testType);
            const points: DataPoint[] = [];

            for (const row of typeRows) {
              const raw = (row.data as Record<string, unknown>)[cfg.metricKey];
              if (typeof raw !== 'number' || !isFinite(raw)) continue;
              const value = cfg.transform ? cfg.transform(raw) : Math.round(raw * 10) / 10;
              points.push({ value, date: row.created_at as string });
            }

            return {
              testType: cfg.testType,
              label: messages.shared.trendLabels[cfg.label as keyof typeof messages.shared.trendLabels] ?? cfg.label,
              unit: cfg.unit,
              points,
              higherIsBetter: cfg.higherIsBetter,
            };
          });

          if (active) setTrends(built);
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadTrends();
      return () => { active = false; };
    }, [messages])
  );

  const hasAnyData = trends.some((t) => t.points.length > 0);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      >
        {/* Header */}
        <View className="mb-8">
          <Text className="text-2xl font-extrabold text-on-surface" style={textAlign}>{messages.trends.title}</Text>
          <Text className="text-sm text-on-surface-variant mt-0.5" style={textAlign}>
            {messages.trends.subtitle}
          </Text>
        </View>

        {loading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#006880" />
          </View>
        ) : !hasAnyData ? (
          /* ── Empty state ── */
          <View className="items-center justify-center py-16 px-4">
            <View className="w-20 h-20 rounded-3xl bg-primary-container items-center justify-center mb-6">
              <Ionicons name="trending-up-outline" size={40} color="#006880" />
            </View>
            <Text className="text-xl font-extrabold text-on-surface text-center mb-3" style={textAlign}>
              {messages.trends.emptyTitle}
            </Text>
            <Text className="text-on-surface-variant text-center leading-relaxed" style={textAlign}>
              {messages.trends.emptyBody}
            </Text>
          </View>
        ) : (
          <>
            {/* Legend */}
            <View
              className="flex-row items-center bg-surface-container-low rounded-2xl px-4 py-3 mb-6"
              style={{ gap: 16 }}
            >
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#006b60' }} />
                <Text className="text-xs text-on-surface-variant font-medium">{messages.trends.improving}</Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#a83836' }} />
                <Text className="text-xs text-on-surface-variant font-medium">{messages.trends.declining}</Text>
              </View>
              <Text className="text-xs text-on-surface-variant ml-auto">{messages.trends.lastBar}</Text>
            </View>

            {trends.map((trend) => (
              <TrendCard
                key={trend.testType}
                trend={trend}
                onPress={() => {/* future: drill-down */}}
                formatShortDate={(value) => formatDate(value, { day: 'numeric', month: 'numeric' })}
                emptyLabel={messages.common.noDataYet}
                readingsLabel={(count) => messages.trends.readingsRecorded.replace('{count}', String(count))}
                accessibilityLabel={formatMessage(messages.trends.trendA11y, { label: trend.label })}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

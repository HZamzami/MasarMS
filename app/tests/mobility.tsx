import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CountdownOverlay } from '../../lib/CountdownOverlay';
import { getLocalizedErrorMessage, useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import {
  Accelerometer,
  Gyroscope,
  type AccelerometerMeasurement,
  type GyroscopeMeasurement,
} from 'expo-sensors';
import { saveTestResult } from '../../lib/saveTestResult';
import type { MobilityData } from '../../lib/types';

type TestState = 'PREPARE' | 'ACTIVE' | 'SAVING' | 'SUMMARY';

type MobilitySummary = {
  uTurnCount: number;
  averageAcceleration: number;
  meanResultantAccelerationBySecond: number[];
  durationSeconds: number;
};

type SubscriptionHandle = { remove: () => void } | null;

const ACTIVE_DURATION_MS = 120_000;
const SENSOR_UPDATE_INTERVAL_MS = 100;
const UTURN_RAD_THRESHOLD = Math.PI;
const UTURN_COOLDOWN_MS = 1_200;

function formatMmSs(totalMs: number) {
  const safeMs = Math.max(0, totalMs);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function extractErrorMessage(
  error: unknown,
  messages: ReturnType<typeof useLocalization>['messages'],
) {
  const baseMessage = getLocalizedErrorMessage(error, messages, messages.common.saveFailed);

  if (typeof error === 'object' && error !== null) {
    const maybeDetails = (error as { details?: unknown }).details;
    if (typeof maybeDetails === 'string' && maybeDetails.length > 0) {
      return `${baseMessage} ${messages.common.details}: ${maybeDetails}`;
    }
  }

  return baseMessage;
}

export default function MobilityTestScreen() {
  const router = useRouter();
  const { backIcon, formatMessage, messages } = useLocalization();

  const [testState, setTestState] = useState<TestState>('PREPARE');
  const [activeRemainingMs, setActiveRemainingMs] = useState(ACTIVE_DURATION_MS);
  const [summary, setSummary] = useState<MobilitySummary | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sensorUnavailable, setSensorUnavailable] = useState(false);

  const testStateRef = useRef<TestState>('PREPARE');
  const activeStartAtRef = useRef<number | null>(null);
  const activeEndAtRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const accelerometerSubRef = useRef<SubscriptionHandle>(null);
  const gyroscopeSubRef = useRef<SubscriptionHandle>(null);

  const accelerationWindowRef = useRef({
    windowStartedAt: 0,
    sum: 0,
    count: 0,
    means: [] as number[],
  });

  const turnDetectionRef = useRef({
    lastSampleAt: 0,
    integratedRadians: 0,
    lastDetectedTurnAt: 0,
    uTurnCount: 0,
  });

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    testStateRef.current = testState;
  }, [testState]);

  const stopCountdownFrame = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const stopSensors = useCallback(() => {
    accelerometerSubRef.current?.remove();
    gyroscopeSubRef.current?.remove();
    accelerometerSubRef.current = null;
    gyroscopeSubRef.current = null;
  }, []);

  const resetSensorTracking = useCallback(() => {
    accelerationWindowRef.current = {
      windowStartedAt: 0,
      sum: 0,
      count: 0,
      means: [],
    };
    turnDetectionRef.current = {
      lastSampleAt: 0,
      integratedRadians: 0,
      lastDetectedTurnAt: 0,
      uTurnCount: 0,
    };
  }, []);

  const handleAccelerometerSample = useCallback((reading: AccelerometerMeasurement) => {
    const now = performance.now();
    const magnitudeMs2 = Math.sqrt(
      (reading.x * reading.x) +
      (reading.y * reading.y) +
      (reading.z * reading.z),
    ) * 9.81;

    const window = accelerationWindowRef.current;
    if (window.windowStartedAt === 0) {
      window.windowStartedAt = now;
    }

    window.sum += magnitudeMs2;
    window.count += 1;

    if ((now - window.windowStartedAt) >= 1_000) {
      if (window.count > 0) {
        window.means.push(window.sum / window.count);
      }
      window.windowStartedAt = now;
      window.sum = 0;
      window.count = 0;
    }
  }, []);

  const handleGyroscopeSample = useCallback((reading: GyroscopeMeasurement) => {
    const now = performance.now();
    const tracker = turnDetectionRef.current;

    if (tracker.lastSampleAt === 0) {
      tracker.lastSampleAt = now;
      return;
    }

    const deltaSeconds = (now - tracker.lastSampleAt) / 1000;
    tracker.lastSampleAt = now;

    const absoluteZ = Math.abs(reading.z);
    if (absoluteZ > 0.35) {
      tracker.integratedRadians += absoluteZ * deltaSeconds;
    } else {
      tracker.integratedRadians = Math.max(0, tracker.integratedRadians - deltaSeconds * 0.6);
    }

    const cooldownPassed = (now - tracker.lastDetectedTurnAt) >= UTURN_COOLDOWN_MS;
    if (tracker.integratedRadians >= UTURN_RAD_THRESHOLD && cooldownPassed) {
      tracker.uTurnCount += 1;
      tracker.integratedRadians = 0;
      tracker.lastDetectedTurnAt = now;
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, []);

  const startSensors = useCallback(async () => {
    stopSensors();
    if (Platform.OS === 'web') {
      setSensorUnavailable(true);
      return;
    }

    try {
      const [accelerometerAvailable, gyroscopeAvailable] = await Promise.all([
        Accelerometer.isAvailableAsync(),
        Gyroscope.isAvailableAsync(),
      ]);

      if (!accelerometerAvailable || !gyroscopeAvailable) {
        setSensorUnavailable(true);
        return;
      }

      setSensorUnavailable(false);
      Accelerometer.setUpdateInterval(SENSOR_UPDATE_INTERVAL_MS);
      Gyroscope.setUpdateInterval(SENSOR_UPDATE_INTERVAL_MS);
      accelerometerSubRef.current = Accelerometer.addListener(handleAccelerometerSample);
      gyroscopeSubRef.current = Gyroscope.addListener(handleGyroscopeSample);
    } catch {
      setSensorUnavailable(true);
      stopSensors();
    }
  }, [handleAccelerometerSample, handleGyroscopeSample, stopSensors]);

  const transitionToSaving = useCallback(() => {
    if (testStateRef.current !== 'ACTIVE') return;
    stopCountdownFrame();
    activeEndAtRef.current = performance.now();
    setActiveRemainingMs(0);
    setTestState('SAVING');
  }, [stopCountdownFrame]);

  const buildSummary = useCallback((): MobilitySummary => {
    const endedAt = activeEndAtRef.current ?? performance.now();
    const startedAt = activeStartAtRef.current ?? endedAt;
    const elapsedMs = Math.max(0, Math.min(ACTIVE_DURATION_MS, endedAt - startedAt));

    const accelWindow = accelerationWindowRef.current;
    if (accelWindow.count > 0) {
      accelWindow.means.push(accelWindow.sum / accelWindow.count);
      accelWindow.sum = 0;
      accelWindow.count = 0;
    }

    const meanPerSecond = [...accelWindow.means];
    const averageAcceleration = meanPerSecond.length > 0
      ? meanPerSecond.reduce((total, value) => total + value, 0) / meanPerSecond.length
      : 0;

    return {
      uTurnCount: turnDetectionRef.current.uTurnCount,
      averageAcceleration,
      meanResultantAccelerationBySecond: meanPerSecond,
      durationSeconds: elapsedMs / 1000,
    };
  }, []);

  const saveSummary = useCallback(async () => {
    const result = buildSummary();
    setSummary(result);
    setSaveError(null);

    try {
      await saveTestResult({
        domain: 'mobility',
        testType: '2MWT',
        data: {
          u_turn_count: result.uTurnCount,
          average_acceleration: Number(result.averageAcceleration.toFixed(4)),
          mean_resultant_acceleration_by_second: result.meanResultantAccelerationBySecond.map(
            (v) => Number(v.toFixed(4)),
          ),
          duration_seconds: Math.round(result.durationSeconds),
          sensor_available: !sensorUnavailable,
        } satisfies MobilityData,
      });

      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      setSaveError(extractErrorMessage(error, messages));
    } finally {
      setTestState('SUMMARY');
    }
  }, [buildSummary, messages, sensorUnavailable]);

  useEffect(() => {
    if (testState !== 'ACTIVE') return;

    setActiveRemainingMs(ACTIVE_DURATION_MS);
    activeStartAtRef.current = performance.now();
    activeEndAtRef.current = null;

    const step = (now: number) => {
      const startedAt = activeStartAtRef.current ?? now;
      const elapsed = now - startedAt;
      const remaining = Math.max(0, ACTIVE_DURATION_MS - elapsed);
      setActiveRemainingMs(remaining);

      if (remaining <= 0) {
        transitionToSaving();
        return;
      }

      rafIdRef.current = requestAnimationFrame(step);
    };

    rafIdRef.current = requestAnimationFrame(step);

    return () => stopCountdownFrame();
  }, [stopCountdownFrame, testState, transitionToSaving]);

  useEffect(() => {
    if (testState === 'ACTIVE') {
      resetSensorTracking();
      void startSensors();
      return;
    }
    stopSensors();
  }, [resetSensorTracking, startSensors, stopSensors, testState]);

  useEffect(() => {
    if (testState !== 'SAVING') return;
    void saveSummary();
  }, [saveSummary, testState]);

  useEffect(() => () => {
    stopCountdownFrame();
    stopSensors();
  }, [stopCountdownFrame, stopSensors]);

  useEffect(() => {
    if (testState !== 'ACTIVE') {
      pulseScale.setValue(1);
      pulseOpacity.setValue(0.1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.12,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.28,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulseOpacity, pulseScale, testState]);

  const activeTimerLabel = useMemo(
    () => formatMmSs(activeRemainingMs),
    [activeRemainingMs],
  );

  const renderActive = () => (
    <View className="flex-1 items-center justify-between py-10 px-6">
      <View className="items-center">
        <Text className="text-sm uppercase tracking-[5px] text-on-surface-variant mb-2">
          {messages.common.timeRemaining}
        </Text>
        <Text className="text-[88px] leading-[92px] font-extrabold text-primary tracking-tight">
          {activeTimerLabel}
        </Text>
      </View>

      <View className="items-center justify-center">
        <View className="w-[220px] h-[220px] items-center justify-center">
          <Animated.View
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: '#006b60',
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            }}
          />
          <View
            className="w-[190px] h-[190px] rounded-full items-center justify-center"
            style={{
              backgroundColor: '#006b60',
              shadowColor: '#006b60',
              shadowOpacity: 0.22,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <MaterialCommunityIcons name="walk" size={110} color="#e2fff8" />
          </View>
        </View>
        <View className="mt-7 bg-[#65fde6]/35 px-8 py-2 rounded-full">
          <Text className="text-tertiary text-[36px] font-bold tracking-wide uppercase">{messages.mobility.walking}</Text>
        </View>
      </View>

      <View className="items-center max-w-[340px]">
        <Text className="text-center text-[44px] leading-[50px] font-bold text-on-surface">
          {messages.mobility.holdPhoneTitle}
        </Text>
        <Text className="text-center text-[34px] leading-[42px] text-on-surface-variant mt-4">
          {messages.mobility.holdPhoneBody}
        </Text>
        {sensorUnavailable ? (
          <Text className="text-center text-sm text-error mt-4">
            {messages.mobility.sensorUnavailable}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        className="w-full rounded-full py-7 items-center justify-center mt-10"
        style={{
          backgroundColor: '#a83836',
          shadowColor: '#6e0a12',
          shadowOpacity: 0.22,
          shadowRadius: 18,
          elevation: 8,
        }}
        onPress={() => {
          if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }
          transitionToSaving();
        }}
        accessibilityRole="button"
        accessibilityLabel={messages.mobility.stopA11y}
      >
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Ionicons name="stop-circle" size={34} color="#fff7f6" />
          <Text className="text-on-error text-[44px] leading-[48px] font-extrabold tracking-[4px] uppercase">
            {messages.mobility.stop}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderSaving = () => (
    <View className="flex-1 items-center justify-center px-8">
      <ActivityIndicator size="large" color="#006880" />
      <Text className="text-xl font-semibold text-on-surface mt-4">
        {messages.mobility.savingTitle}
      </Text>
      <Text className="text-sm text-on-surface-variant mt-2 text-center">
        {messages.mobility.savingBody}
      </Text>
    </View>
  );

  const renderSummary = () => {
    const uTurnCount = summary?.uTurnCount ?? 0;
    const averageAcceleration = summary?.averageAcceleration ?? 0;
    const durationSeconds = summary?.durationSeconds ?? 0;

    return (
      <View className="flex-1 px-6 pt-8 pb-6">
        <Text className="text-[52px] leading-[56px] font-extrabold text-on-surface-variant mb-4">
          {messages.mobility.summaryTitle}
        </Text>

        <View className="bg-[#72d9fd]/30 rounded-xl p-5 flex-row items-center mb-6" style={{ gap: 12 }}>
          <View className="w-14 h-14 rounded-full items-center justify-center bg-tertiary">
            <Ionicons name="checkmark-circle" size={28} color="#e2fff8" />
          </View>
          <View className="flex-1">
            <Text className="text-primary font-bold text-lg">{messages.mobility.successTitle}</Text>
            <Text className="text-on-surface-variant text-sm">
              {messages.mobility.successBody}
            </Text>
          </View>
        </View>

        <View className="bg-surface-container-low rounded-[24px] p-6 mb-4">
          <Text className="text-xs uppercase tracking-[2px] text-on-surface-variant">
            {messages.mobility.uTurnCount}
          </Text>
          <Text className="text-[56px] leading-[62px] font-extrabold text-primary mt-2">
            {uTurnCount}
          </Text>
        </View>

        <View className="bg-surface-container-low rounded-[24px] p-6 mb-4 items-center">
          <Text className="text-xs uppercase tracking-[2px] text-on-surface-variant mb-4">
            {messages.mobility.averageAcceleration}
          </Text>
          <View className="w-36 h-36 rounded-full border-[10px] border-tertiary items-center justify-center">
            <Text className="text-2xl font-extrabold text-on-surface">
              {averageAcceleration.toFixed(2)}
            </Text>
            <Text className="text-xs font-medium text-tertiary mt-1">{messages.mobility.accelerationUnit}</Text>
          </View>
        </View>

        <View className="bg-surface-container-lowest rounded-[24px] p-6 mb-8 border border-outline-variant/20">
          <Text className="text-lg font-bold text-on-surface mb-2">{messages.mobility.performanceInsights}</Text>
          <Text className="text-sm text-on-surface-variant">
            {formatMessage(messages.mobility.sessionLength, {
              seconds: durationSeconds.toFixed(1),
            })}
          </Text>
          {saveError ? (
            <Text className="text-xs text-error mt-3">
              {formatMessage(messages.mobility.savedLocallyOnly, { error: saveError })}
            </Text>
          ) : (
            <Text className="text-xs text-tertiary mt-3">
              {messages.mobility.observationSaved}
            </Text>
          )}
        </View>

        <TouchableOpacity
          className="w-full rounded-full py-4 items-center"
          style={{
            backgroundColor: '#006880',
            shadowColor: '#006880',
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6,
          }}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel={messages.common.backToDashboard}
        >
          <Text className="text-on-primary font-bold text-base">{messages.common.backToDashboard}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <View className="h-16 bg-surface-container-low px-6 flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={20}
            accessibilityRole="button"
            accessibilityLabel={messages.common.back}
          >
            <Ionicons name={backIcon} size={24} color="#006880" />
          </TouchableOpacity>
          <Text className="font-bold text-lg text-primary">{messages.common.appName}</Text>
        </View>

        {testState !== 'SUMMARY' ? (
          <View className="px-3 py-1 rounded-full bg-[#006880]/10">
            <Text className="text-xs font-semibold text-primary">{messages.mobility.title}</Text>
          </View>
        ) : (
          <View className="w-10 h-10 rounded-full bg-surface-container-highest items-center justify-center">
            <Ionicons name="person" size={18} color="#006880" />
          </View>
        )}
      </View>

      {testState === 'PREPARE' && (
        <View className="flex-1">
          <View className="flex-1 opacity-40">
            {renderActive()}
          </View>
          <CountdownOverlay onFinished={() => setTestState('ACTIVE')} />
        </View>
      )}
      {testState === 'ACTIVE' ? renderActive() : null}
      {testState === 'SAVING' ? renderSaving() : null}
      {testState === 'SUMMARY' ? renderSummary() : null}
    </SafeAreaView>
  );
}

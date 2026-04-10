import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import { supabase } from '../../lib/supabase';

type Mode = 'login' | 'signup';
type Screen = 'form' | 'verify';

function localizeAuthError(
  rawMessage: string,
  messages: ReturnType<typeof useLocalization>['messages'],
) {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes('invalid login credentials')) return messages.auth.invalidCredentials;
  if (normalized.includes('email not confirmed')) return messages.auth.emailNotConfirmed;
  if (normalized.includes('user already registered')) return messages.auth.emailAlreadyRegistered;
  if (normalized.includes('password should be at least 6 characters')) return messages.auth.weakPassword;

  return messages.auth.genericError;
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { messages, backIcon, inputAlign, row, textAlign } = useLocalization();

  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'login');
  const [screen, setScreen] = useState<Screen>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendInfo, setResendInfo] = useState<string | null>(null);

  // Navigation is intentionally NOT done here — _layout.tsx handles all routing
  // via onAuthStateChange (SIGNED_IN) so the phenotype check always runs.
  async function signIn() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(localizeAuthError(error.message, messages));
    // On success: _layout.tsx onAuthStateChange fires SIGNED_IN and routes the user
  }

  async function signUp() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(localizeAuthError(error.message, messages));
    } else {
      setScreen('verify');
    }
  }

  async function resendVerification() {
    setResendInfo(null);
    setResendLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResendLoading(false);
    if (error) {
      setResendInfo(messages.auth.resendFailed.replace('{message}', localizeAuthError(error.message, messages)));
    } else {
      setResendInfo(messages.auth.resendSuccess);
    }
  }

  function handleSubmit() {
    if (mode === 'login') void signIn();
    else void signUp();
  }

  // ── Email verification screen ──────────────────────────────────────────────
  if (screen === 'verify') {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <LanguageToggleBar />
        <View className="flex-1 items-center justify-center px-8">
          {/* Icon */}
          <View className="w-24 h-24 rounded-full bg-primary-container items-center justify-center mb-8">
            <Ionicons name="mail-outline" size={48} color="#006880" />
          </View>

          <Text className="text-3xl font-extrabold text-on-surface text-center mb-3">
            {messages.auth.checkEmail}
          </Text>
          <Text className="text-on-surface-variant text-center leading-7 mb-2">
            {messages.auth.confirmationSentTo}
          </Text>
          <Text className="font-bold text-primary text-center mb-8">{email}</Text>

          <View
            className="w-full bg-surface-container-low rounded-2xl p-5 mb-8"
            style={{ gap: 12 }}
          >
            {messages.auth.emailSteps.map((step, i) => (
              <View key={i} className="flex-row items-center" style={[{ gap: 12 }, row]}>
                <View className="w-7 h-7 rounded-full bg-primary items-center justify-center">
                  <Text className="text-on-primary font-bold text-xs">{i + 1}</Text>
                </View>
                <Text className="text-on-surface font-medium" style={textAlign}>{step}</Text>
              </View>
            ))}
          </View>

          {resendInfo && (
            <Text className="text-xs text-primary text-center mb-4">{resendInfo}</Text>
          )}

          <TouchableOpacity
            onPress={() => void resendVerification()}
            disabled={resendLoading}
            className="mb-4"
          >
            <Text className="text-primary font-semibold text-sm">
              {resendLoading ? messages.auth.sending : messages.auth.resendEmail}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setScreen('form');
              setMode('login');
            }}
            className="w-full bg-primary rounded-full py-5 items-center mt-4"
            accessibilityRole="button"
            accessibilityLabel={messages.auth.a11yGoToSignIn}
          >
            <Text className="text-on-primary font-bold text-lg">{messages.auth.signIn}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Auth form ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingVertical: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back to welcome */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="self-start mb-8"
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel={messages.auth.a11yGoBackToWelcome}
          >
            <Ionicons name={backIcon} size={24} color="#006880" />
          </TouchableOpacity>

          {/* Branding */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-primary-container items-center justify-center mb-4">
              <MaterialCommunityIcons name="brain" size={34} color="#006880" />
            </View>
            <Text className="text-3xl font-extrabold text-on-surface tracking-tight mb-1">
              {mode === 'login' ? messages.auth.welcomeBack : messages.auth.createAccount}
            </Text>
            <Text className="text-on-surface-variant text-sm text-center" style={textAlign}>
              {mode === 'login'
                ? messages.auth.signInSubtitle
                : messages.auth.signUpSubtitle}
            </Text>
          </View>

          {/* Error banner */}
          {error && (
            <View
              className="rounded-2xl p-4 mb-5 flex-row items-center"
              style={[{ backgroundColor: 'rgba(168,56,54,0.08)', gap: 10 }, row]}
            >
              <Ionicons name="alert-circle-outline" size={20} color="#a83836" />
              <Text className="flex-1 text-sm text-error" style={textAlign}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-on-surface-variant mb-2 ms-1">
              {messages.auth.emailAddress}
            </Text>
            <View className="flex-row items-center bg-surface-container-highest rounded-2xl px-4 h-14" style={row}>
              <Ionicons name="mail-outline" size={20} color="#737c80" />
              <TextInput
                className="flex-1 ms-3 text-base text-on-surface"
                style={inputAlign}
                placeholder={messages.auth.emailPlaceholder}
                placeholderTextColor="#aab3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
                accessibilityLabel={messages.auth.emailAddress}
              />
            </View>
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-on-surface-variant mb-2 ms-1">
              {messages.auth.password}
            </Text>
            <View className="flex-row items-center bg-surface-container-highest rounded-2xl px-4 h-14" style={row}>
              <Ionicons name="lock-closed-outline" size={20} color="#737c80" />
              <TextInput
                className="flex-1 ms-3 text-base text-on-surface"
                style={inputAlign}
                placeholder={mode === 'signup' ? messages.auth.signupPasswordPlaceholder : messages.auth.loginPasswordPlaceholder}
                placeholderTextColor="#aab3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                accessibilityLabel={messages.auth.password}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={showPassword ? messages.auth.hidePassword : messages.auth.showPassword}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#737c80"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="w-full bg-primary rounded-full h-14 items-center justify-center mb-4"
            style={{ opacity: loading ? 0.7 : 1 }}
            accessibilityRole="button"
            accessibilityLabel={mode === 'login' ? messages.auth.signIn : messages.auth.createAccount}
          >
            {loading ? (
              <ActivityIndicator color="#f1faff" />
            ) : (
              <Text className="text-on-primary font-bold text-base">
                {mode === 'login' ? messages.auth.signIn : messages.auth.createAccountCta}
              </Text>
            )}
          </TouchableOpacity>

          {/* Mode toggle */}
          <TouchableOpacity
            onPress={() => {
              setMode((m) => (m === 'login' ? 'signup' : 'login'));
              setError(null);
            }}
            className="items-center py-3"
            accessibilityRole="button"
          >
            <Text className="text-primary font-semibold text-sm">
              {mode === 'login'
                ? messages.auth.noAccount
                : messages.auth.alreadyHaveAccount}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

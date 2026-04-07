import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";

type Mode = "login" | "signup";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.replace("/(tabs)");
    }
  }

  async function signUp() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setInfo("Check your email to confirm your account.");
    }
  }

  function handleSubmit() {
    if (mode === "login") {
      signIn();
    } else {
      signUp();
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#f7fafc]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View className="w-full max-w-md items-center mb-10">
          <View className="p-4 bg-[#72d9fd]/20 rounded-full mb-5">
            <MaterialCommunityIcons name="brain" size={48} color="#006880" />
          </View>
          <Text className="text-4xl font-extrabold text-[#2b3438] tracking-tighter mb-1">
            Masar MS
          </Text>
          <Text className="text-[#576065] font-medium">
            Cognitive Clarity & Health Management
          </Text>
        </View>

        {/* Card */}
        <View className="w-full max-w-md bg-white rounded-[2rem] p-8 shadow-xl">
          {/* Error banner */}
          {error && (
            <View className="bg-[#fa746f]/10 rounded-xl p-3 mb-4">
              <Text className="text-[#a83836] text-sm">{error}</Text>
            </View>
          )}

          {/* Info banner */}
          {info && (
            <View className="bg-[#72d9fd]/20 rounded-xl p-3 mb-4">
              <Text className="text-[#006880] text-sm">{info}</Text>
            </View>
          )}

          <Text className="text-2xl font-bold text-[#2b3438] mb-1">
            {mode === "login" ? "Welcome back" : "Create account"}
          </Text>
          <Text className="text-[#576065] text-sm mb-6">
            {mode === "login"
              ? "Please enter your details to sign in."
              : "Fill in your details to get started."}
          </Text>

          {/* Email */}
          <View className="flex-row items-center bg-[#f0f4f5] rounded-2xl px-4 mb-4 h-14">
            <Ionicons name="mail-outline" size={20} color="#576065" />
            <TextInput
              className="flex-1 ml-3 text-base text-[#2b3438]"
              placeholder="Email address"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              accessibilityLabel="Email address"
            />
          </View>

          {/* Password */}
          <View className="flex-row items-center bg-[#f0f4f5] rounded-2xl px-4 mb-2 h-14">
            <Ionicons name="lock-closed-outline" size={20} color="#576065" />
            <TextInput
              className="flex-1 ml-3 text-base text-[#2b3438]"
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              accessibilityLabel="Password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#576065"
              />
            </TouchableOpacity>
          </View>

          {/* Forgot password */}
          {mode === "login" && (
            <TouchableOpacity
              className="self-end mb-6"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-[#006880] text-sm font-medium">
                Forgot password?
              </Text>
            </TouchableOpacity>
          )}

          {mode === "signup" && <View className="mb-6" />}

          {/* Primary button */}
          <TouchableOpacity
            className="h-14 rounded-2xl items-center justify-center mb-3"
            style={{ backgroundColor: loading ? "#004d61" : "#006880" }}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={mode === "login" ? "Sign in" : "Create account"}
          >
            <Text className="text-white font-bold text-base">
              {loading
                ? "Please wait…"
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </Text>
          </TouchableOpacity>

          {/* Toggle mode button */}
          <TouchableOpacity
            className="h-14 rounded-2xl items-center justify-center border-2 border-[#dce4e6]"
            onPress={() => {
              setMode((m) => (m === "login" ? "signup" : "login"));
              setError(null);
              setInfo(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              mode === "login" ? "Switch to sign up" : "Switch to sign in"
            }
          >
            <Text className="text-[#006880] font-semibold text-base">
              {mode === "login" ? "Create an Account" : "Back to Sign In"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text className="text-[#576065] text-xs mt-8 text-center">
          Masar MS · Empowering Multiple Sclerosis care
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

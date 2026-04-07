import { Text, View } from "react-native";
import { TouchableOpacity } from "react-native";
import { supabase } from "../../lib/supabase";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-[#f7fafc]">
      <Text className="text-2xl font-bold text-[#2b3438] mb-6">
        Welcome to Masar MS
      </Text>
      <TouchableOpacity
        className="bg-[#006880] px-6 py-3 rounded-xl"
        onPress={() => supabase.auth.signOut()}
      >
        <Text className="text-white font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

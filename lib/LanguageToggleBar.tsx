import { Text, TouchableOpacity, View } from 'react-native';
import { useLocalization } from './i18n';

export function LanguageToggleBar() {
  const { isRTL, language, messages, toggleLanguage } = useLocalization();

  return (
    <View className="px-6 pt-2 pb-1">
      <View style={{ minHeight: 42, position: 'relative' }}>
        <TouchableOpacity
          className="rounded-2xl bg-surface-container-low px-4 py-2.5 border border-outline-variant/30"
          style={isRTL ? { position: 'absolute', left: 0 } : { position: 'absolute', right: 0 }}
          onPress={() => void toggleLanguage()}
          accessibilityRole="button"
          accessibilityLabel={messages.common.languageToggleA11y}
        >
          <Text className="text-[11px] font-black text-primary uppercase tracking-wide">
            {language === 'en' ? messages.common.switchToArabic : messages.common.switchToEnglish}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

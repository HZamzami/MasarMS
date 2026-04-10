import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { I18nManager, Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { translations, type AppLanguage, type AppMessages } from './messages';

const STORAGE_KEY = 'app.language';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type LocalizationContextValue = {
  language: AppLanguage;
  isRTL: boolean;
  locale: string;
  messages: AppMessages;
  setLanguage: (next: AppLanguage) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  formatMessage: (template: string, values?: Record<string, string | number>) => string;
  formatNumber: (value: number) => string;
  backIcon: IoniconName;
  forwardIcon: IoniconName;
  chevronForwardIcon: IoniconName;
  screenDirection: { direction: 'rtl' | 'ltr' };
  textAlign: { textAlign: 'right' | 'left' };
  inputAlign: { textAlign: 'right' | 'left'; writingDirection: 'rtl' | 'ltr' };
  row: { flexDirection: 'row' };
  rowReverse: { flexDirection: 'row-reverse' };
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  translateTestType: (value: string) => string;
  translateDomain: (value: string) => string;
  translateFrequency: (value: string) => string;
  translatePhenotype: (value: string | null | undefined) => string | null;
};

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

function extractErrorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return null;
}

function applyNativeDirection(language: AppLanguage) {
  if (Platform.OS === 'web') return false;

  const shouldRTL = language === 'ar';
  const changed = I18nManager.isRTL !== shouldRTL;
  I18nManager.allowRTL(shouldRTL);
  I18nManager.forceRTL(shouldRTL);
  I18nManager.swapLeftAndRightInRTL(shouldRTL);
  return changed;
}

export async function loadStoredLanguage(): Promise<AppLanguage> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  const language: AppLanguage = stored === 'en' ? 'en' : 'ar';
  applyNativeDirection(language);
  return language;
}

export function getLocalizedErrorMessage(
  error: unknown,
  messages: AppMessages,
  fallback: string,
): string {
  const raw = extractErrorText(error);

  if (!raw) return fallback;
  if (raw === 'No authenticated user found.') return messages.common.sessionExpired;
  if (raw === 'Unable to save observation.' || raw === 'Failed to save mobility observation.') {
    return fallback;
  }

  return raw;
}

export function LocalizationProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: AppLanguage;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    if (next === language) return;

    await AsyncStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  }, [language]);

  const toggleLanguage = useCallback(async () => {
    await setLanguage(language === 'en' ? 'ar' : 'en');
  }, [language, setLanguage]);

  const isRTL = language === 'ar';
  const locale = isRTL ? 'ar-SA' : 'en-US';
  const messages = translations[language];

  const value = useMemo<LocalizationContextValue>(() => ({
    language,
    isRTL,
    locale,
    messages,
    setLanguage,
    toggleLanguage,
    formatMessage: (template, values = {}) => Object.entries(values).reduce(
      (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
      template,
    ),
    formatNumber: (value) => new Intl.NumberFormat(locale).format(value),
    backIcon: isRTL ? 'arrow-forward' : 'arrow-back',
    forwardIcon: isRTL ? 'arrow-back' : 'arrow-forward',
    chevronForwardIcon: isRTL ? 'chevron-back' : 'chevron-forward',
    screenDirection: { direction: isRTL ? 'rtl' : 'ltr' },
    textAlign: { textAlign: isRTL ? 'right' : 'left' },
    inputAlign: { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
    row: { flexDirection: 'row' },
    rowReverse: { flexDirection: 'row-reverse' },
    formatDate: (value, options) => new Date(value).toLocaleDateString(locale, options),
    formatTime: (value, options) => new Date(value).toLocaleTimeString(locale, options),
    translateTestType: (value) => messages.shared.testTypes[value as keyof typeof messages.shared.testTypes] ?? value,
    translateDomain: (value) => messages.shared.domains[value as keyof typeof messages.shared.domains] ?? value,
    translateFrequency: (value) => messages.shared.frequencyLabels[value as keyof typeof messages.shared.frequencyLabels] ?? value,
    translatePhenotype: (value) => value
      ? messages.shared.phenotypes[value as keyof typeof messages.shared.phenotypes] ?? value
      : null,
  }), [isRTL, language, locale, messages, setLanguage, toggleLanguage]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within LocalizationProvider');
  }
  return context;
}

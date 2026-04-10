import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocalization } from '../../lib/i18n';
import { LanguageToggleBar } from '../../lib/LanguageToggleBar';
import { supabase } from '../../lib/supabase';

interface HistoryItem {
  id: string;
  test_type: string;
  domain: string;
  created_at: string;
}

export default function HistoryScreen() {
  const { formatDate, formatTime, messages, row, textAlign, translateDomain, translateTestType } = useLocalization();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('test_results')
        .select('id, test_type, domain, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [])
  );

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const date = new Date(item.created_at);
    return (
      <View className="flex-row items-center p-4 bg-surface-container-low rounded-2xl mb-3 border border-outline-variant/20" style={row}>
        <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center me-4">
          <Ionicons name="clipboard-outline" size={20} color="#006880" />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-on-surface" style={textAlign}>{translateTestType(item.test_type)}</Text>
          <Text className="text-[11px] text-on-surface-variant font-bold uppercase tracking-tight" style={textAlign}>
            {translateDomain(item.domain)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs font-bold text-on-surface-variant">
            {formatDate(date, { month: 'short', day: 'numeric' })}
          </Text>
          <Text className="text-[10px] text-on-surface-variant">
            {formatTime(date, { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <LanguageToggleBar />
      <View className="flex-1 px-6 pt-4">
        <View className="mb-8">
          <Text className="text-3xl font-black text-on-surface tracking-tight" style={textAlign}>{messages.history.title}</Text>
          <Text className="text-sm text-on-surface-variant font-bold mt-1" style={textAlign}>{messages.history.subtitle}</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#006880" />
          </View>
        ) : history.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="time-outline" size={64} color="#aab3b8" />
            <Text className="text-on-surface-variant font-bold mt-4" style={textAlign}>{messages.history.empty}</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

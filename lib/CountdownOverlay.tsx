import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalization } from './i18n';

interface CountdownOverlayProps {
  onFinished: () => void;
}

export function CountdownOverlay({ onFinished }: CountdownOverlayProps) {
  const { messages } = useLocalization();
  const [count, setCount] = useState(3);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count === 0) {
      onFinished();
    }
  }, [count, onFinished]);

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }

        scaleAnim.setValue(1.5);
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start();

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (count === 0) return null;

  return (
    <Animated.View 
      style={[
        styles.container, 
        { opacity: opacityAnim }
      ]}
    >
      <View style={styles.content}>
        <Animated.Text 
          style={[
            styles.text, 
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          {count}
        </Animated.Text>
        <Text style={styles.subtext}>{messages.common.ready}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 10000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  text: {
    fontSize: 120,
    fontWeight: '900',
    color: '#006880',
  },
  subtext: {
    fontSize: 24,
    fontWeight: '700',
    color: '#006880',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginTop: -10,
  },
});

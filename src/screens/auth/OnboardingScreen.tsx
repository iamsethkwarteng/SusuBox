import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/src/constants/colors';

const ONBOARDING_SEEN_KEY = 'susutrack_onboarding_seen';
const { width } = Dimensions.get('window');

interface Slide {
  key: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  bg: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    key: 'save-together',
    icon: 'account-group',
    bg: '#4A90B8',
    title: 'Save together',
    description: 'Join a trusted group, contribute regularly, and receive your share.',
  },
  {
    key: 'momo',
    icon: 'cellphone-nfc',
    bg: Colors.primary,
    title: 'Pay with Mobile Money',
    description: 'Contribute instantly with MTN, Telecel, or your bank card via secure Paystack checkout.',
  },
  {
    key: 'transparent',
    icon: 'shield-check',
    bg: Colors.success,
    title: 'Transparent payouts',
    description: 'See every contribution, penalty, and payout breakdown before money moves — no surprises.',
  },
];

async function finishOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
  router.replace('/(auth)/register');
}

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const handleNext = () => {
    if (index === SLIDES.length - 1) {
      finishOnboarding();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1 });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.brand}>SusuSavings</Text>
        <TouchableOpacity onPress={finishOnboarding}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.illustration, { backgroundColor: item.bg }]}>
              <View style={styles.phoneMock}>
                <MaterialCommunityIcons name={item.icon} size={64} color={item.bg} />
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((slide, i) => (
          <View key={slide.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextLabel}>{index === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  brand: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  skip: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  slide: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  illustration: {
    width: '100%',
    height: 340,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  phoneMock: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 20,
  },
  footer: {
    padding: 24,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextLabel: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      {/* Gesture disabled: an unverified user must not be able to swipe back
          into the registration flow they have already completed. */}
      <Stack.Screen name="verify-email" options={{ gestureEnabled: false }} />
      {/* Same reasoning for the PIN prompt — swiping back would leave the user
          half-authenticated on the previous screen. "Back to login" is the
          only way out. */}
      <Stack.Screen name="two-fa" options={{ gestureEnabled: false }} />
      <Stack.Screen name="reset-pin" />
    </Stack>
  );
}

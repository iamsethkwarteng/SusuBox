import { MD3LightTheme } from 'react-native-paper';

import { Colors } from '@/src/constants/colors';

// Maps the SusuTrack brand palette onto Material Design 3 role tokens so
// every React Native Paper component (TextInput, Button, Checkbox, …)
// matches the rest of the hand-styled UI without per-component overrides.
export const paperTheme = {
  ...MD3LightTheme,
  roundness: 14,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    onPrimary: Colors.white,
    secondary: Colors.success,
    error: Colors.danger,
    background: Colors.background,
    surface: Colors.surface,
    onSurface: Colors.textPrimary,
    outline: Colors.border,
  },
};

export default paperTheme;

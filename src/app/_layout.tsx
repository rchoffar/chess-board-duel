import { View } from 'react-native';
import { Stack, ThemeProvider as NavigationThemeProvider, DarkTheme } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Jost_300Light } from '@expo-google-fonts/jost';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
} from '@expo-google-fonts/geist';
import { EnvironmentBackground } from '../components/ui/EnvironmentBackground';
import { ThemeProvider } from '../design-system/ThemeProvider';

SplashScreen.preventAutoHideAsync();

// Modal screens present in their own native container, so the root
// EnvironmentBackground is not behind them — they need an opaque dark bg.
const MODAL_BG = '#101114';

// expo-router defaults to react-navigation's light theme, whose container
// paints a white background above our EnvironmentBackground. Transparent
// background + dark palette lets the Skia environment show through.
const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: MODAL_BG },
};

function RootNavigator() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0C0E' }}>
      <EnvironmentBackground />
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="new-game"
          options={{ presentation: 'modal', contentStyle: { backgroundColor: MODAL_BG } }}
        />
        <Stack.Screen
          name="game"
          options={{
            presentation: 'fullScreenModal',
            gestureEnabled: false,
            contentStyle: { backgroundColor: MODAL_BG },
          }}
        />
        <Stack.Screen name="game/[id]" />
        <Stack.Screen name="game/review/[id]" />
        <Stack.Screen name="player/[id]" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Jost_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync('#0B0C0E').catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationThemeProvider value={NAV_THEME}>
            <RootNavigator />
          </NavigationThemeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

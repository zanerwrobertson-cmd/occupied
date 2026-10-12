import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FavoritesProvider } from '@/state/favorites';
import { OccupancyProvider } from '@/state/occupancy';
import { useTheme } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  const { t, scheme } = useTheme();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <OccupancyProvider>
        <FavoritesProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
        </FavoritesProvider>
      </OccupancyProvider>
    </SafeAreaProvider>
  );
}

/**
 * ROOT LAYOUT — the first thing that runs when the app opens.
 *
 * Expo Router treats every file in src/app/ as a screen. A file called `_layout.tsx` is special:
 * it wraps all the screens next to it. This one:
 *   1. keeps the splash screen up until the Figtree fonts have loaded,
 *   2. wraps the whole app in "providers" (shared data every screen can read), and
 *   3. sets up a Stack navigator, so opening a building slides a new screen on top of the list.
 */

// --- Imports -------------------------------------------------------------------------------
// Each Figtree_* is one weight of the Figtree font; useFonts loads them from the package.
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

// "@/..." is a shortcut for "src/..." (set up in tsconfig.json under "paths").
import { FavoritesProvider } from '@/state/favorites';
import { OccupancyProvider } from '@/state/occupancy';
import { useTheme } from '@/theme/theme';

// Keep the native splash screen visible until we say otherwise (below), so users never see
// text flash in the wrong font. `.catch(() => {})` ignores the harmless error some platforms
// throw if the splash screen is already gone.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // useFonts starts loading the fonts and re-renders this component when it's done.
  // `loaded` becomes true on success; `error` is set if loading failed.
  const [loaded, error] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });

  // Colours for the current light/dark mode (see src/theme/theme.ts).
  const { t, scheme } = useTheme();

  // useEffect runs after the screen renders. Once fonts finish (or fail), hide the splash.
  // If fonts fail we still continue — the app falls back to the system font.
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // Still loading fonts: render nothing (the splash screen is covering everything anyway).
  if (!loaded && !error) return null;

  return (
    // SafeAreaProvider measures the notch / status bar / home indicator so screens can avoid them.
    <SafeAreaProvider>
      {/* OccupancyProvider fetches the busyness data and refreshes it; any screen can read it
          with useOccupancy(). See src/state/occupancy.tsx. */}
      <OccupancyProvider>
        {/* FavoritesProvider remembers starred buildings on the device. See src/state/favorites.tsx. */}
        <FavoritesProvider>
          {/* Status bar text: light on dark backgrounds, dark on light ones. */}
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {/* Stack = screens pile on top of each other (Home → Building detail → Back).
              headerShown: false because each screen draws its own header. */}
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
        </FavoritesProvider>
      </OccupancyProvider>
    </SafeAreaProvider>
  );
}

import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/navigation';

// KHABAR — a fully native app (real screens calling gorkhatv.site's own
// /api/* endpoints), replacing the earlier WebView wrapper. That wrapper
// could never actually lock itself to news: the website's own client-side
// router swaps pages with fetch(), which a WebView's navigation hook can't
// see, so tapping around the site silently left /genre/news. Native screens
// have no such escape. Same structure as CHIMAL/SWARA.
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#141414" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}

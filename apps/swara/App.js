import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/navigation';

// SWARA (formerly "GorkhaTV Beats") — Phase S: a fully native app (real screens calling
// gorkhatv.site's own /api/* endpoints), replacing the earlier WebView-
// wrapper approach. That version is preserved in git history (see this
// project's own commit log) rather than deleted outright.
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#141414" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}

import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/navigation';

// CHIMAL — a fully native app (real screens calling gorkhatv.site's own
// /api/* endpoints), built fresh rather than renamed from any of the old
// 6-genre apps it replaces (Talkies/Diaries/Laughs), since there's no single
// website URL that shows movies+shortfilms+comedy+entertainment+vlogs
// merged. Same structure as SWARA (gorkhatv-mobile) — see this project's own
// Phase S/T plans.
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#141414" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}

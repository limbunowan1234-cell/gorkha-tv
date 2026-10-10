import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/navigation';

// CHIMAL: "Stories in full bloom." Cinema from the hills. A streaming-style
// app: a hero carousel, poster rows per category (Movies, Short Films, Comedy,
// Entertainment, Vlogs and Magic), Continue watching that remembers where you
// stopped, a My List kept on the phone, and a cinematic title page. Playback
// is the real embedded YouTube player.
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#101216" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}

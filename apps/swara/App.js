import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/navigation';

// SWARA: "Hear the hills." A music app built around the voice: a chart-first
// home, the artists behind the songs, a library (liked songs + recently
// played) kept on the phone, and a Now Playing screen with a moving
// waveform and a sleep timer. Playback is the real embedded YouTube player.
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#101216" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}

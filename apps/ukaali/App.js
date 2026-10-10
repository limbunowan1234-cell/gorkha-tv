import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/navigation';

// UKAALI: a fully native reels app: a vertical feed with
// instant thumbnails and the next reel's player already warm, category chips
// (including Magic), a progress line, double-tap to save, and a Saved
// tab kept on the phone. Playback is always the real embedded YouTube player.
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}

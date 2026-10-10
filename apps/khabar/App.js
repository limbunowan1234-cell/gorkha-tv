import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/navigation';

// KHABAR: "The facts, first." A news app that behaves like a newsroom: a
// headline-first list with a lead story and BREAKING tags on fresh items,
// "Play bulletin" to run the headlines like a broadcast, news by town, search,
// saved stories kept on the phone, and the source behind every story.
// Playback is the real embedded YouTube player.
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#101216" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}

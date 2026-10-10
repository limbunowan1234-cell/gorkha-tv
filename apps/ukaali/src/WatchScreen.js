import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReelFeed from './ReelFeed';
import { colors } from './theme';

// Full-screen player for a list handed in from the Saved tab, starting at the
// tapped reel.
export default function WatchScreen({ route, navigation }) {
  const { items, index } = route.params;
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ReelFeed items={items} initialIndex={index} />
      <Pressable style={[styles.back, { top: insets.top + 10 }]} onPress={() => navigation.goBack()} hitSlop={10}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  back: { position: 'absolute', left: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(16,18,22,0.65)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.snow, fontSize: 28, lineHeight: 30, marginTop: -2 },
});

import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useSaved } from '../storage';
import StoryRow from '../components/StoryRow';

// Stories you saved to read (watch) later, kept on this phone.
export default function SavedScreen({ navigation }) {
  const saved = useSaved();
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.heading}>Saved</Text>
      <Text style={styles.sub}>{saved.length ? `${saved.length} stories on this phone` : 'Stories for later'}</Text>
      <FlatList
        data={saved}
        keyExtractor={(s) => s.youtube_video_id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📰</Text>
            <Text style={styles.emptyText}>Tap “Save story” on anything you want to come back to.</Text>
          </View>
        }
        renderItem={({ item, index }) => <StoryRow story={item} onPress={() => navigation.navigate('Story', { story: item, queue: saved, queueIndex: index })} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  heading: { color: colors.snow, fontSize: 26, fontWeight: '900', paddingHorizontal: 16, paddingTop: 12 },
  sub: { color: colors.mist, fontSize: 13, paddingHorizontal: 16, marginTop: 2, marginBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 36 },
  emptyIcon: { fontSize: 44 },
  emptyText: { color: colors.mist, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 12 },
});

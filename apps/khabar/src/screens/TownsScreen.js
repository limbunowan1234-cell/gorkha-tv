import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchNews } from '../api';
import { colors, TOWNS } from '../theme';
import StoryRow from '../components/StoryRow';

// News by town: Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri, Sikkim.
export default function TownsScreen({ navigation }) {
  const [town, setTown] = useState(TOWNS[0]);
  const [stories, setStories] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStories(null);
    fetchNews({ location: town, limit: 30 })
      .then((l) => !cancelled && setStories(l))
      .catch(() => !cancelled && setStories([]));
    return () => {
      cancelled = true;
    };
  }, [town]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.heading}>Your town</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
        {TOWNS.map((t) => {
          const on = t === town;
          return (
            <Pressable key={t} onPress={() => setTown(t)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {stories === null ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(s) => s.youtube_video_id}
          ListEmptyComponent={<Text style={styles.empty}>No stories from {town} just yet.</Text>}
          renderItem={({ item, index }) => <StoryRow story={item} onPress={() => navigation.navigate('Story', { story: item, queue: stories, queueIndex: index })} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  heading: { color: colors.snow, fontSize: 26, fontWeight: '900', paddingHorizontal: 16, paddingTop: 12 },
  chips: { paddingHorizontal: 16, gap: 8, paddingVertical: 14 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(49,131,242,0.5)', backgroundColor: colors.brandTint },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  chipTextOn: { color: '#fff' },
  empty: { color: colors.mist, textAlign: 'center', padding: 32 },
});

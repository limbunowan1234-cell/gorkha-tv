import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../api';
import { colors, spacing, APP_NAME } from '../theme';
import VideoCard from '../components/VideoCard';

const LOCATIONS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'Sikkim'];

// SWARA's home screen ("top10_top100" kind, matching the website's
// own gorkhatv2/js/genre.js distinction) — Top 10 This Week + one row per
// region. The other 4 category-genre apps (Talkies/Diaries/Bulletin/Laughs)
// use a different FeedScreen shape (Trending + Latest + region rows) — see
// Phase S's plan.
//
// Top 20 Artists was cut from here per direct feedback ("hide this large
// artist list from homepage") — the full vertical list took up too much of
// the home screen. Wanted back later as a more compact button/chip-style
// treatment instead, not a big list — deliberately not guessed at here.
export default function FeedScreen({ navigation }) {
  const [top10, setTop10] = useState([]);
  const [byLocation, setByLocation] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ chart }, { byLocation: bl }] = await Promise.all([
          apiFetch('/chart'),
          apiFetch('/genre/music').catch(() => ({ byLocation: {} })),
        ]);
        if (cancelled) return;
        setTop10((chart || []).slice(0, 10));
        setByLocation(bl || {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // `list`+`index` seed "auto next" (VideoScreen.js) — whichever row a
  // track was tapped from becomes the queue it advances through.
  const goToVideo = (video, list, index) => navigation.navigate('Video', { videoId: video.youtube_video_id, queue: list, queueIndex: index });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <Text style={styles.header}>{APP_NAME}</Text>

        <SectionTitle title="🎵 Top 10 This Week" />
        <FlatList
          data={top10}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(v) => v.youtube_video_id}
          contentContainerStyle={styles.row}
          renderItem={({ item, index }) => (
            <VideoCard video={item} rank={index + 1} horizontal onPress={() => goToVideo(item, top10, index)} />
          )}
        />
        <Pressable style={styles.seeAllBtn} onPress={() => navigation.navigate('Chart')}>
          <Text style={styles.seeAllText}>See All 100 →</Text>
        </Pressable>

        {LOCATIONS.filter((loc) => (byLocation[loc] || []).length).map((loc) => (
          <View key={loc}>
            <SectionTitle title={`Top 10 ${loc}`} />
            <FlatList
              data={byLocation[loc]}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(v) => v.youtube_video_id}
              contentContainerStyle={styles.row}
              renderItem={({ item, index }) => (
                <VideoCard video={item} rank={index + 1} horizontal onPress={() => goToVideo(item, byLocation[loc], index)} />
              )}
            />
          </View>
        ))}

        {!loading && top10.length === 0 && <Text style={styles.empty}>No chart data yet — check back soon.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { color: colors.brand, fontSize: 28, fontWeight: '700', padding: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.md, marginLeft: spacing.md },
  row: { paddingHorizontal: spacing.sm },
  seeAllBtn: { alignSelf: 'flex-start', marginLeft: spacing.md, marginTop: spacing.xs, backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 4 },
  seeAllText: { color: '#000', fontWeight: '700', fontSize: 13 },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
});

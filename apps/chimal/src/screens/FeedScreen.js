import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../api';
import { colors, spacing, APP_NAME } from '../theme';
import VideoCard from '../components/VideoCard';

// CHIMAL merges movies/short films/comedy/entertainment/vlogs into one feed
// — same categories, same merge approach (trending by trend_score, latest by
// published_at, byLocation unioned then re-sorted by engagement) as the
// website's own gorkhatv2/js/genre.js loadMultiTrendingLatest(). No single
// /api/genre/:category call covers all 5, so this fires one per category and
// merges client-side, same as the website does.
const CATEGORIES = ['movies', 'shortfilms', 'comedy', 'entertainment', 'vlogs'];
const LOCATIONS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'Sikkim'];
const LOCATION_EMOJI = { Darjeeling: '🏔️', Kalimpong: '🌄', Kurseong: '🌿', Mirik: '🌸', Siliguri: '🏙️', Sikkim: '🏞️' };

export default function FeedScreen({ navigation }) {
  const [trending, setTrending] = useState([]);
  const [latest, setLatest] = useState([]);
  const [byLocation, setByLocation] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          CATEGORIES.map((cat) => apiFetch(`/genre/${cat}`).catch(() => ({ trending: [], latest: [], byLocation: {} })))
        );
        if (cancelled) return;

        setTrending(
          results.flatMap((r) => r.trending || []).sort((a, b) => (b.trend_score || 0) - (a.trend_score || 0)).slice(0, 20)
        );
        setLatest(
          results.flatMap((r) => r.latest || []).sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, 20)
        );

        const merged = {};
        for (const r of results) {
          for (const [loc, items] of Object.entries(r.byLocation || {})) {
            (merged[loc] ||= []).push(...items);
          }
        }
        for (const loc of Object.keys(merged)) {
          merged[loc] = merged[loc]
            .sort((a, b) => (b.view_count + (b.like_count || 0) * 10) - (a.view_count + (a.like_count || 0) * 10) || new Date(b.published_at) - new Date(a.published_at))
            .slice(0, 10);
        }
        setByLocation(merged);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // `list`+`index` seed "auto next" (VideoScreen.js) — whichever row a video
  // was tapped from becomes the queue it advances through.
  const goToVideo = (video, list, index) => navigation.navigate('Video', { videoId: video.youtube_video_id, queue: list, queueIndex: index });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <Text style={styles.header}>{APP_NAME}</Text>

        <SectionTitle title="🔥 Trending" />
        <FlatList
          data={trending}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(v) => v.youtube_video_id}
          contentContainerStyle={styles.row}
          renderItem={({ item, index }) => <VideoCard video={item} horizontal onPress={() => goToVideo(item, trending, index)} />}
          ListEmptyComponent={<Text style={styles.empty}>No trending videos yet — check back soon.</Text>}
        />

        <SectionTitle title="🆕 Latest" />
        <FlatList
          data={latest}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(v) => v.youtube_video_id}
          contentContainerStyle={styles.row}
          renderItem={({ item, index }) => <VideoCard video={item} horizontal onPress={() => goToVideo(item, latest, index)} />}
        />

        {LOCATIONS.filter((loc) => (byLocation[loc] || []).length).map((loc) => (
          <View key={loc}>
            <SectionTitle title={`${LOCATION_EMOJI[loc] || ''} Top 10 ${loc}`} />
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
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { color: colors.brand, fontSize: 28, fontWeight: '700', padding: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.md, marginLeft: spacing.md },
  row: { paddingHorizontal: spacing.sm },
  empty: { color: colors.muted, marginLeft: spacing.md },
});

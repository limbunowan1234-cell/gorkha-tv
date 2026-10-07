import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../api';
import { colors, spacing, APP_NAME } from '../theme';
import VideoCard from '../components/VideoCard';

// KHABAR is a single category (news): one /api/genre/news call returns
// trending, latest and byLocation directly, so no client-side merging is
// needed (unlike CHIMAL, which spans five categories).
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
        const r = await apiFetch('/genre/news');
        if (cancelled) return;
        setTrending((r.trending || []).slice(0, 20));
        setLatest((r.latest || []).slice(0, 20));
        setByLocation(r.byLocation || {});
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

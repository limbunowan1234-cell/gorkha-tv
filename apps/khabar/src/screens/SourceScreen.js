import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch, formatCount } from '../api';
import { colors } from '../theme';
import StoryRow from '../components/StoryRow';

// A news source (a reporter or channel): who they are, and their stories.
// :channelId accepts a root-level slug or the raw YouTube channel id.
export default function SourceScreen({ route, navigation }) {
  const { channelId } = route.params;
  const [source, setSource] = useState(null);
  const [stories, setStories] = useState([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiFetch(`/creators/${encodeURIComponent(channelId)}`)
      .then(({ creator, videos }) => {
        setSource(creator);
        setStories(videos || []);
      })
      .catch(() => setNotFound(true));
  }, [channelId]);

  if (notFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Source not found</Text>
      </View>
    );
  }
  if (!source) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <FlatList
        data={stories}
        keyExtractor={(s) => s.youtube_video_id}
        ListHeaderComponent={
          <View style={styles.head}>
            {source.thumbnail_url ? <Image source={{ uri: source.thumbnail_url }} style={styles.avatar} resizeMode="cover" /> : <View style={styles.avatar} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{source.channel_name}</Text>
              <Text style={styles.meta}>
                {stories.length} stories{source.followerCount ? `  ·  ${formatCount(source.followerCount)} followers` : ''}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No stories published yet</Text>}
        renderItem={({ item, index }) => <StoryRow story={item} onPress={() => navigation.push('Story', { story: item, queue: stories, queueIndex: index })} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.mist },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 3, borderBottomColor: colors.brand },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.slate },
  name: { color: colors.snow, fontSize: 19, fontWeight: '900' },
  meta: { color: colors.mist, fontSize: 12, marginTop: 4 },
  empty: { color: colors.mist, textAlign: 'center', padding: 24 },
});

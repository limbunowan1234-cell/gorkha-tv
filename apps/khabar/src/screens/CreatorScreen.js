import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch, formatCount } from '../api';
import { colors, spacing } from '../theme';
import VideoCard from '../components/VideoCard';

// :channelId accepts either a root-level slug or the raw YouTube channel id
// — GET /api/creators/:id resolves either (see functions/api/creators/[id].js).
export default function CreatorScreen({ route, navigation }) {
  const { channelId } = route.params;
  const [creator, setCreator] = useState(null);
  const [videos, setVideos] = useState([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiFetch(`/creators/${encodeURIComponent(channelId)}`)
      .then(({ creator, videos }) => {
        setCreator(creator);
        setVideos(videos || []);
      })
      .catch(() => setNotFound(true));
  }, [channelId]);

  if (notFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Creator not found</Text>
      </View>
    );
  }

  if (!creator) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={videos}
        keyExtractor={(v) => v.youtube_video_id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.sm }}
        ListHeaderComponent={
          <View style={styles.header}>
            {creator.thumbnail_url ? (
              <Image source={{ uri: creator.thumbnail_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar} />
            )}
            <Text style={styles.name}>{creator.channel_name}</Text>
            <Text style={styles.meta}>{formatCount(creator.followerCount)} followers</Text>
            {creator.description ? <Text style={styles.description}>{creator.description}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <VideoCard video={item} onPress={() => navigation.push('Video', { videoId: item.youtube_video_id })} />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No published videos yet</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: colors.muted, fontSize: 14 },
  header: { alignItems: 'center', padding: spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface2 },
  name: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  description: { color: colors.muted, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
});

import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch, formatCount } from '../api';
import { colors } from '../theme';
import SongRow from '../components/SongRow';

// :channelId accepts either a root-level slug or the raw YouTube channel id.
export default function ArtistScreen({ route, navigation }) {
  const { channelId } = route.params;
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiFetch(`/creators/${encodeURIComponent(channelId)}`)
      .then(({ creator, videos }) => {
        setArtist(creator);
        setSongs(videos || []);
      })
      .catch(() => setNotFound(true));
  }, [channelId]);

  if (notFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Artist not found</Text>
      </View>
    );
  }
  if (!artist) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const play = (index) => navigation.navigate('Player', { videoId: songs[index].youtube_video_id, queue: songs, queueIndex: index });

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <FlatList
        data={songs}
        keyExtractor={(v) => v.youtube_video_id}
        ListHeaderComponent={
          <View>
            <View style={styles.banner}>
              {artist.banner_url ? <Image source={{ uri: artist.banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
              <LinearGradient colors={['rgba(16,18,22,0.2)', colors.night]} style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.head}>
              {artist.thumbnail_url ? <Image source={{ uri: artist.thumbnail_url }} style={styles.avatar} resizeMode="cover" /> : <View style={styles.avatar} />}
              <Text style={styles.name}>{artist.channel_name}</Text>
              <Text style={styles.meta}>{songs.length} songs{artist.followerCount ? ` · ${formatCount(artist.followerCount)} followers` : ''}</Text>
              {songs.length > 0 && (
                <Pressable style={styles.playAll} onPress={() => play(0)}>
                  <Text style={styles.playAllText}>▶  Play all</Text>
                </Pressable>
              )}
            </View>
          </View>
        }
        renderItem={({ item, index }) => <SongRow song={item} onPress={() => play(index)} />}
        ListEmptyComponent={<Text style={styles.empty}>No songs published yet</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.mist },
  banner: { height: 130, backgroundColor: colors.slate },
  head: { alignItems: 'center', marginTop: -44, paddingBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.slate, borderWidth: 3, borderColor: colors.brand },
  name: { color: colors.snow, fontSize: 21, fontWeight: '900', marginTop: 10 },
  meta: { color: colors.mist, fontSize: 12, marginTop: 4 },
  playAll: { marginTop: 14, backgroundColor: colors.brand, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 10 },
  playAllText: { color: colors.night, fontSize: 13, fontWeight: '900' },
  empty: { color: colors.mist, textAlign: 'center', padding: 24 },
});

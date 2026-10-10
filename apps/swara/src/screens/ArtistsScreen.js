import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch, formatCount } from '../api';
import { colors } from '../theme';

// The voices behind the songs: the top 20 artists ranked by total engagement
// across their whole catalog (not just their single best song).
export default function ArtistsScreen({ navigation }) {
  const [artists, setArtists] = useState(null);

  useEffect(() => {
    apiFetch('/top-artists')
      .then(({ artists }) => setArtists(artists || []))
      .catch(() => setArtists([]));
  }, []);

  if (artists === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={artists}
        keyExtractor={(a) => a.youtube_channel_id}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.heading}>The voices</Text>
            <Text style={styles.sub}>Top 20 artists of the hills.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate('Artist', { channelId: item.slug || item.youtube_channel_id })}>
            <Text style={[styles.rank, index < 3 && styles.rankTop]}>{index + 1}</Text>
            <Image source={{ uri: item.thumbnail_url }} style={styles.avatar} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.channel_name}
              </Text>
              <Text style={styles.meta}>
                {item.video_count} songs · {formatCount(item.total_engagement)} plays
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  heading: { color: colors.snow, fontSize: 26, fontWeight: '900' },
  sub: { color: colors.mist, fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  rank: { width: 30, textAlign: 'center', color: colors.mist, fontSize: 20, fontWeight: '800' },
  rankTop: { color: colors.brand },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.slate },
  name: { color: colors.snow, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.mist, fontSize: 12, marginTop: 3 },
  chev: { color: colors.mist, fontSize: 24 },
});

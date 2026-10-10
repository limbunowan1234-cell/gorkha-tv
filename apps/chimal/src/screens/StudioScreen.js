import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch, formatCount } from '../api';
import { colors } from '../theme';
import Poster from '../components/Poster';

// A creator's studio: their banner, name, and every title they have on CHIMAL.
// :channelId accepts a root-level slug or the raw YouTube channel id.
export default function StudioScreen({ route, navigation }) {
  const { channelId } = route.params;
  const { width } = useWindowDimensions();
  const [studio, setStudio] = useState(null);
  const [titles, setTitles] = useState([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiFetch(`/creators/${encodeURIComponent(channelId)}`)
      .then(({ creator, videos }) => {
        setStudio(creator);
        setTitles(videos || []);
      })
      .catch(() => setNotFound(true));
  }, [channelId]);

  if (notFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Studio not found</Text>
      </View>
    );
  }
  if (!studio) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const cols = 3;
  const cardW = Math.floor((width - 16 * 2 - 10 * (cols - 1)) / cols);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <FlatList
        key={cols}
        data={titles}
        numColumns={cols}
        keyExtractor={(v) => v.youtube_video_id}
        contentContainerStyle={{ paddingHorizontal: 11, paddingBottom: 24 }}
        columnWrapperStyle={{ marginBottom: 12 }}
        ListHeaderComponent={
          <View style={{ marginHorizontal: -11 }}>
            <View style={styles.banner}>
              {studio.banner_url ? <Image source={{ uri: studio.banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
              <LinearGradient colors={['rgba(16,18,22,0.2)', colors.night]} style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.head}>
              {studio.thumbnail_url ? <Image source={{ uri: studio.thumbnail_url }} style={styles.avatar} resizeMode="cover" /> : <View style={styles.avatar} />}
              <Text style={styles.name}>{studio.channel_name}</Text>
              <Text style={styles.meta}>
                {titles.length} titles{studio.followerCount ? `  ·  ${formatCount(studio.followerCount)} followers` : ''}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No titles published yet</Text>}
        renderItem={({ item }) => <Poster video={item} width={cardW} onPress={() => navigation.push('Title', { video: item })} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.mist },
  banner: { height: 130, backgroundColor: colors.slate },
  head: { alignItems: 'center', marginTop: -44, paddingBottom: 18 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.slate, borderWidth: 3, borderColor: colors.brand },
  name: { color: colors.snow, fontSize: 21, fontWeight: '900', marginTop: 10 },
  meta: { color: colors.mist, fontSize: 12, marginTop: 4 },
  empty: { color: colors.mist, textAlign: 'center', padding: 24 },
});

import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch, ytThumb, formatCount } from '../api';
import { colors, TAGLINE } from '../theme';
import Waveform from '../components/Waveform';

const LOCATIONS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'Sikkim'];

// "Hear" — SWARA's home. A hero for this week's #1, the Top 10 as big-numeral
// cards, the voices behind the songs, and a row of sur per town.
export default function FeedScreen({ navigation }) {
  const [chart, setChart] = useState([]);
  const [artists, setArtists] = useState([]);
  const [byLocation, setByLocation] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/chart').catch(() => ({ chart: [] })),
      apiFetch('/top-artists').catch(() => ({ artists: [] })),
      apiFetch('/genre/music').catch(() => ({ byLocation: {} })),
    ]).then(([c, a, g]) => {
      if (cancelled) return;
      setChart(c.chart || []);
      setArtists(a.artists || []);
      setByLocation(g.byLocation || {});
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const play = (list, index) => navigation.navigate('Player', { videoId: list[index].youtube_video_id, queue: list, queueIndex: index });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const hero = chart[0];
  const top10 = chart.slice(0, 10);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>SWARA</Text>
            <Text style={styles.tagline}>{TAGLINE}</Text>
          </View>
          <Waveform playing={false} height={34} />
        </View>

        {hero && (
          <Pressable style={styles.hero} onPress={() => play(chart, 0)}>
            <Image source={{ uri: ytThumb(hero) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(16,18,22,0.96)']} style={StyleSheet.absoluteFill} />
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>#1 THIS WEEK</Text>
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {hero.title}
              </Text>
              <Text style={styles.heroArtist} numberOfLines={1}>
                {hero.channel_name} · {formatCount(hero.view_count)} plays
              </Text>
              <View style={styles.playBtn}>
                <Text style={styles.playBtnText}>▶  Play the chart</Text>
              </View>
            </View>
          </Pressable>
        )}

        <Section title="Top 10" action="Full chart" onAction={() => navigation.navigate('Chart')} />
        <FlatList
          data={top10}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(v) => v.youtube_video_id}
          contentContainerStyle={styles.hRow}
          renderItem={({ item, index }) => (
            <Pressable style={styles.topCard} onPress={() => play(top10, index)}>
              <Image source={{ uri: ytThumb(item) }} style={styles.topCover} resizeMode="cover" />
              <Text style={styles.topRank}>{index + 1}</Text>
              <Text style={styles.topTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.topArtist} numberOfLines={1}>
                {item.channel_name}
              </Text>
            </Pressable>
          )}
        />

        {artists.length > 0 && (
          <>
            <Section title="The voices" action="All artists" onAction={() => navigation.navigate('Artists')} />
            <FlatList
              data={artists.slice(0, 12)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(a) => a.youtube_channel_id}
              contentContainerStyle={styles.hRow}
              renderItem={({ item }) => (
                <Pressable style={styles.artist} onPress={() => navigation.navigate('Artist', { channelId: item.slug || item.youtube_channel_id })}>
                  <Image source={{ uri: item.thumbnail_url }} style={styles.artistImg} resizeMode="cover" />
                  <Text style={styles.artistName} numberOfLines={1}>
                    {item.channel_name}
                  </Text>
                </Pressable>
              )}
            />
          </>
        )}

        {LOCATIONS.filter((l) => (byLocation[l] || []).length).map((loc) => (
          <View key={loc}>
            <Section title={`Sur of ${loc}`} />
            <FlatList
              data={byLocation[loc]}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(v) => v.youtube_video_id}
              contentContainerStyle={styles.hRow}
              renderItem={({ item, index }) => (
                <Pressable style={styles.topCard} onPress={() => play(byLocation[loc], index)}>
                  <Image source={{ uri: ytThumb(item) }} style={styles.topCover} resizeMode="cover" />
                  <Text style={styles.topTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.topArtist} numberOfLines={1}>
                    {item.channel_name}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, action, onAction }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  logo: { color: colors.brand, fontSize: 30, fontWeight: '900', letterSpacing: 2 },
  tagline: { color: colors.mist, fontSize: 12, marginTop: 2, letterSpacing: 0.6 },
  hero: { marginHorizontal: 16, height: 230, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.slate, justifyContent: 'space-between' },
  heroPill: { alignSelf: 'flex-start', margin: 14, backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  heroPillText: { color: colors.night, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  heroBody: { padding: 16 },
  heroTitle: { color: colors.snow, fontSize: 20, fontWeight: '800', lineHeight: 25 },
  heroArtist: { color: colors.mist, fontSize: 12, marginTop: 4 },
  playBtn: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: colors.snow, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10 },
  playBtnText: { color: colors.night, fontSize: 13, fontWeight: '800' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16, marginTop: 26, marginBottom: 10 },
  sectionTitle: { color: colors.snow, fontSize: 18, fontWeight: '800' },
  sectionAction: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  hRow: { paddingHorizontal: 12 },
  topCard: { width: 148, marginHorizontal: 4 },
  topCover: { width: 148, height: 148, borderRadius: 14, backgroundColor: colors.slate },
  topRank: { position: 'absolute', left: 8, top: 4, color: colors.snow, fontSize: 34, fontWeight: '900', textShadowColor: 'rgba(16,18,22,0.9)', textShadowRadius: 8 },
  topTitle: { color: colors.snow, fontSize: 13, fontWeight: '700', marginTop: 8, lineHeight: 17 },
  topArtist: { color: colors.mist, fontSize: 11, marginTop: 2 },
  artist: { width: 84, alignItems: 'center', marginHorizontal: 6 },
  artistImg: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.slate, borderWidth: 2, borderColor: colors.brand },
  artistName: { color: colors.snow, fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'center' },
});

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import YoutubeIframe from 'react-native-youtube-iframe';
import * as Haptics from 'expo-haptics';
import { apiFetch, formatCount, formatDuration, recordView } from '../api';
import { colors } from '../theme';
import { myList, progress } from '../storage';
import Poster from '../components/Poster';

// A title's page: cinema-style. The real YouTube player on black, then the
// big title, details, My List / Share, and "More like this". Where you stop is
// saved on the phone every 10 seconds so Home can offer "Continue watching",
// and reopening a title picks up from there.
export default function TitleScreen({ route, navigation }) {
  const { video: initial } = route.params;
  const { width } = useWindowDimensions();
  const [video, setVideo] = useState(initial);
  const [related, setRelated] = useState([]);
  const [playing, setPlaying] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const playerRef = useRef(null);
  const list = myList.use();
  const [startAt, setStartAt] = useState(null); // null until the saved resume point has been read

  const id = initial.youtube_video_id;
  const inList = list.some((s) => s.youtube_video_id === id);
  const isShort = !!initial.isShort;

  useEffect(() => {
    let cancelled = false;
    progress.get(id).then((p) => {
      if (!cancelled) setStartAt(p && p.seconds > 10 && p.seconds < p.duration * 0.92 ? Math.floor(p.seconds) : 0);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    recordView(id);
    apiFetch(`/videos/${encodeURIComponent(id)}`)
      .then(({ video: v }) => !cancelled && setVideo({ ...initial, ...v }))
      .catch(() => {});
    apiFetch(`/videos/${encodeURIComponent(id)}/related`)
      .then(({ related: r }) => !cancelled && setRelated(r || []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Save progress every 10s while this screen is open, and once when leaving.
  useEffect(() => {
    const save = async () => {
      try {
        const [cur, dur] = await Promise.all([playerRef.current?.getCurrentTime(), playerRef.current?.getDuration()]);
        if (dur) progress.save(video, cur, dur);
      } catch {
        /* player not ready */
      }
    };
    const t = setInterval(save, 10000);
    return () => {
      clearInterval(t);
      save();
    };
  }, [video]);

  const playerWidth = width;
  const playerHeight = isShort ? Math.round(width * 1.45) : Math.round((width * 9) / 16);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ width: playerWidth, height: playerHeight, backgroundColor: '#000' }}>
          {startAt !== null && (
          <YoutubeIframe
            ref={playerRef}
            width={playerWidth}
            height={playerHeight}
            videoId={id}
            play={playing}
            initialPlayerParams={{ start: startAt, modestbranding: true, rel: false }}
            onChangeState={(s) => s === 'ended' && setPlaying(false)}
            webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
          />
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.eyebrow}>CHIMAL  ·  {String(video.category || '').toUpperCase()}</Text>
          <Text style={styles.title}>{video.title}</Text>
          <Text style={styles.meta}>
            {[formatDuration(video.duration_seconds), video.location, video.view_count ? `${formatCount(video.view_count)} views` : null].filter(Boolean).join('  ·  ')}
          </Text>
          {startAt > 0 && <Text style={styles.resume}>Resumed from where you left off</Text>}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, inList && styles.btnOn]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                myList.toggle(video);
              }}
            >
              <Text style={[styles.btnText, inList && styles.btnTextOn]}>{inList ? '✓ In My List' : '+ My List'}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => Share.share({ message: `${video.title}\nhttps://gorkhatv.site/watch/${id}` }).catch(() => {})}>
              <Text style={styles.btnText}>↗ Share</Text>
            </Pressable>
          </View>

          {video.channel_name ? (
            <Pressable style={styles.studio} onPress={() => navigation.push('Studio', { channelId: video.channel_slug || video.youtube_channel_id })}>
              <Text style={styles.studioLabel}>FROM</Text>
              <Text style={styles.studioName}>{video.channel_name}  ›</Text>
            </Pressable>
          ) : null}

          {video.description ? (
            <Pressable onPress={() => setExpanded((e) => !e)}>
              <Text style={styles.desc} numberOfLines={expanded ? undefined : 4}>
                {video.description}
              </Text>
              <Text style={styles.more}>{expanded ? 'Show less' : 'Show more'}</Text>
            </Pressable>
          ) : null}
        </View>

        {related.length > 0 && (
          <View style={{ marginTop: 10, paddingBottom: 28 }}>
            <Text style={styles.moreTitle}>More like this</Text>
            <FlatList
              data={related}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(v) => v.youtube_video_id}
              contentContainerStyle={{ paddingHorizontal: 11 }}
              renderItem={({ item }) => <Poster video={item} onPress={() => navigation.push('Title', { video: item })} />}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  info: { padding: 18 },
  eyebrow: { color: colors.brand, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.snow, fontSize: 24, fontWeight: '900', lineHeight: 29, marginTop: 8 },
  meta: { color: colors.mist, fontSize: 12, marginTop: 8 },
  resume: { color: colors.brand, fontSize: 12, fontWeight: '700', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { borderRadius: 8, paddingHorizontal: 18, height: 40, justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(244,241,234,0.4)' },
  btnOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  btnText: { color: colors.snow, fontSize: 13, fontWeight: '800' },
  btnTextOn: { color: colors.night },
  studio: { marginTop: 18, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(244,241,234,0.1)' },
  studioLabel: { color: colors.mist, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  studioName: { color: colors.snow, fontSize: 15, fontWeight: '700', marginTop: 3 },
  desc: { color: colors.mist, fontSize: 13, lineHeight: 20, marginTop: 16 },
  more: { color: colors.brand, fontSize: 12, fontWeight: '800', marginTop: 6 },
  moreTitle: { color: colors.snow, fontSize: 18, fontWeight: '900', paddingHorizontal: 16, marginBottom: 10 },
});

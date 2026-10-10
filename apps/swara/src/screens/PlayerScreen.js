import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { apiFetch, formatCount, recordView } from '../api';
import { colors } from '../theme';
import { likedSongs, recentSongs } from '../storage';
import SongRow from '../components/SongRow';
import YoutubePlayer from '../components/YoutubePlayer';
import Waveform from '../components/Waveform';

const SLEEP_STEPS = [0, 15, 30, 60]; // minutes; 0 = off

// Now playing. The real YouTube player sits in a rounded frame; under it the
// song's waveform moves while it plays. Extras: heart a song into your
// library, share it, and a sleep timer that stops the music for you.
export default function PlayerScreen({ route, navigation }) {
  const { videoId, queue, queueIndex } = route.params;
  const { width: screenWidth } = useWindowDimensions();
  const [video, setVideo] = useState(null);
  const [related, setRelated] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [audible, setAudible] = useState(false);
  const [sleepIdx, setSleepIdx] = useState(0);
  const [sleepNote, setSleepNote] = useState('');
  const advancedRef = useRef(false);
  const liked = likedSongs.useList();

  const nextInQueue = queue && queueIndex != null && queueIndex + 1 < queue.length ? queue[queueIndex + 1] : null;
  const nextVideo = nextInQueue || related[0] || null;
  const upNext = nextInQueue ? queue.slice(queueIndex + 1) : related;

  const handleEnd = () => {
    if (!nextVideo || advancedRef.current) return;
    advancedRef.current = true;
    navigation.replace('Player', nextInQueue ? { videoId: nextVideo.youtube_video_id, queue, queueIndex: queueIndex + 1 } : { videoId: nextVideo.youtube_video_id });
  };

  useEffect(() => {
    let cancelled = false;
    setVideo(null);
    setNotFound(false);
    advancedRef.current = false;
    (async () => {
      try {
        const { video } = await apiFetch(`/videos/${encodeURIComponent(videoId)}`);
        if (cancelled) return;
        setVideo(video);
        recordView(videoId);
        recentSongs.push(video);
        apiFetch(`/videos/${encodeURIComponent(videoId)}/related`)
          .then(({ related }) => !cancelled && setRelated(related || []))
          .catch(() => {});
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Sleep timer: stop the music after N minutes. Lives on this screen; leaving
  // it clears the timer.
  useEffect(() => {
    const minutes = SLEEP_STEPS[sleepIdx];
    if (!minutes) return undefined;
    const t = setTimeout(() => {
      setPlaying(false);
      setSleepIdx(0);
      setSleepNote('Sleep timer ended. Good night 🌙');
    }, minutes * 60 * 1000);
    return () => clearTimeout(t);
  }, [sleepIdx]);

  const cycleSleep = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setSleepNote('');
    setSleepIdx((i) => (i + 1) % SLEEP_STEPS.length);
  }, []);

  const isLiked = !!video && liked.some((s) => s.youtube_video_id === video.youtube_video_id);

  if (notFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Song not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.playerWrap}>
          <YoutubePlayer videoId={videoId} width={screenWidth - 32} playing={playing} setPlaying={setPlaying} onEnd={handleEnd} onPlayingChange={setAudible} />
        </View>

        <View style={styles.wave}>
          <Waveform playing={audible} height={52} />
        </View>

        {!video ? (
          <ActivityIndicator color={colors.brand} style={{ margin: 24 }} />
        ) : (
          <View style={styles.info}>
            <Text style={styles.title}>{video.title}</Text>
            <Pressable onPress={() => navigation.push('Artist', { channelId: video.channel_slug || video.youtube_channel_id })}>
              <Text style={styles.artist}>{video.channel_name}</Text>
            </Pressable>
            <Text style={styles.meta}>{[video.view_count ? `${formatCount(video.view_count)} plays` : null, video.location].filter(Boolean).join(' · ')}</Text>

            <View style={styles.actions}>
              <Pill
                label={isLiked ? '♥ Liked' : '♡ Like'}
                on={isLiked}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  likedSongs.toggle(video);
                }}
              />
              <Pill label="↗ Share" onPress={() => Share.share({ message: `${video.title}\nhttps://gorkhatv.site/watch/${video.youtube_video_id}` }).catch(() => {})} />
              <Pill label={SLEEP_STEPS[sleepIdx] ? `🌙 ${SLEEP_STEPS[sleepIdx]} min` : '🌙 Sleep'} on={!!SLEEP_STEPS[sleepIdx]} onPress={cycleSleep} />
            </View>
            {sleepNote ? <Text style={styles.note}>{sleepNote}</Text> : null}
          </View>
        )}

        {upNext.length > 0 && (
          <View style={{ marginTop: 18, paddingBottom: 24 }}>
            <Text style={styles.upNext}>Up next</Text>
            {upNext.map((s, i) => (
              <SongRow
                key={s.youtube_video_id}
                song={s}
                onPress={() =>
                  navigation.push('Player', nextInQueue ? { videoId: s.youtube_video_id, queue, queueIndex: queueIndex + 1 + i } : { videoId: s.youtube_video_id })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill({ label, onPress, on }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, on && styles.pillOn]}>
      <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.mist },
  playerWrap: { margin: 16, borderRadius: 20, shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  wave: { alignItems: 'center', marginTop: 4 },
  info: { paddingHorizontal: 20, alignItems: 'center', marginTop: 14 },
  title: { color: colors.snow, fontSize: 20, fontWeight: '800', textAlign: 'center', lineHeight: 26 },
  artist: { color: colors.brand, fontSize: 15, fontWeight: '700', marginTop: 8 },
  meta: { color: colors.mist, fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  pill: { paddingHorizontal: 16, height: 38, borderRadius: 19, justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(230,71,157,0.45)', backgroundColor: colors.brandTint },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  pillTextOn: { color: colors.night },
  note: { color: colors.mist, fontSize: 12, marginTop: 12 },
  upNext: { color: colors.snow, fontSize: 16, fontWeight: '800', paddingHorizontal: 16, marginBottom: 6 },
});

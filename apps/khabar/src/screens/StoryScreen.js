import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import YoutubeIframe from 'react-native-youtube-iframe';
import * as Haptics from 'expo-haptics';
import { apiFetch, recordView, timeAgo, isFresh, formatCount } from '../api';
import { colors } from '../theme';
import { toggleSaved, useSaved } from '../storage';
import StoryRow from '../components/StoryRow';

// A story: headline first, then the video. In bulletin mode (started from
// "Play bulletin") the next headline starts by itself when this one ends,
// like a news broadcast; otherwise "Up next" is just a list.
export default function StoryScreen({ route, navigation }) {
  const { story: initial, queue, queueIndex, bulletin } = route.params;
  const id = initial.youtube_video_id;
  const [story, setStory] = useState(initial);
  const [related, setRelated] = useState([]);
  const [playing, setPlaying] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const advanced = useRef(false);
  const saved = useSaved();
  const isSaved = saved.some((s) => s.youtube_video_id === id);

  const nextInQueue = queue && queueIndex != null && queueIndex + 1 < queue.length ? queue[queueIndex + 1] : null;
  const upNext = nextInQueue ? queue.slice(queueIndex + 1, queueIndex + 12) : related;

  useEffect(() => {
    let cancelled = false;
    advanced.current = false;
    setPlaying(true);
    recordView(id);
    setLoading(true);
    apiFetch(`/videos/${encodeURIComponent(id)}`)
      .then(({ video }) => !cancelled && setStory({ ...initial, ...video }))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    apiFetch(`/videos/${encodeURIComponent(id)}/related`)
      .then(({ related: r }) => !cancelled && setRelated(r || []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const goNext = () => {
    if (!bulletin || !nextInQueue || advanced.current) return;
    advanced.current = true;
    navigation.replace('Story', { story: nextInQueue, queue, queueIndex: queueIndex + 1, bulletin: true });
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          {isFresh(story.published_at) && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>BREAKING</Text>
            </View>
          )}
          <Text style={styles.headline}>{story.title}</Text>
          <Text style={styles.meta}>{[story.channel_name, timeAgo(story.published_at), story.location].filter(Boolean).join('  ·  ')}</Text>
        </View>

        <View style={styles.player}>
          <YoutubeIframe
            height={220}
            videoId={id}
            play={playing}
            onChangeState={(s) => {
              if (s === 'ended') {
                setPlaying(false);
                goNext();
              }
            }}
            webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
          />
        </View>
        {bulletin && nextInQueue ? <Text style={styles.bulletinNote}>Bulletin on: the next headline plays when this one ends.</Text> : null}

        <View style={styles.actions}>
          <Pill
            label={isSaved ? '✓ Saved' : '+ Save story'}
            on={isSaved}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              toggleSaved(story);
            }}
          />
          <Pill label="↗ Share" onPress={() => Share.share({ message: `${story.title}\nhttps://gorkhatv.site/watch/${id}` }).catch(() => {})} />
        </View>

        {story.channel_name ? (
          <Pressable style={styles.source} onPress={() => navigation.push('Source', { channelId: story.channel_slug || story.youtube_channel_id })}>
            <Text style={styles.sourceLabel}>SOURCE</Text>
            <Text style={styles.sourceName}>{story.channel_name}  ›</Text>
          </Pressable>
        ) : null}

        {loading && !story.description ? <ActivityIndicator color={colors.brand} style={{ margin: 16 }} /> : null}
        {story.description ? (
          <Pressable onPress={() => setExpanded((e) => !e)} style={{ paddingHorizontal: 16 }}>
            <Text style={styles.desc} numberOfLines={expanded ? undefined : 5}>
              {story.description}
            </Text>
            <Text style={styles.more}>{expanded ? 'Show less' : 'Read more'}</Text>
          </Pressable>
        ) : null}
        {story.view_count ? <Text style={styles.views}>{formatCount(story.view_count)} views</Text> : null}

        {upNext.length > 0 && (
          <View style={{ marginTop: 18, paddingBottom: 24 }}>
            <Text style={styles.upNext}>{nextInQueue ? 'Up next' : 'Related stories'}</Text>
            {upNext.map((s, i) => (
              <StoryRow
                key={s.youtube_video_id}
                story={s}
                onPress={() =>
                  navigation.push('Story', nextInQueue ? { story: s, queue, queueIndex: queueIndex + 1 + i, bulletin } : { story: s })
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
  head: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.breaking, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 8 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  headline: { color: colors.snow, fontSize: 22, fontWeight: '900', lineHeight: 29 },
  meta: { color: colors.mist, fontSize: 12, marginTop: 8 },
  player: { backgroundColor: '#000', borderTopWidth: 3, borderTopColor: colors.brand },
  bulletinNote: { color: colors.brand, fontSize: 12, fontWeight: '700', paddingHorizontal: 16, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  pill: { paddingHorizontal: 16, height: 38, borderRadius: 8, justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(49,131,242,0.5)', backgroundColor: colors.brandTint },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  pillTextOn: { color: '#fff' },
  source: { marginHorizontal: 16, marginVertical: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(244,241,234,0.15)' },
  sourceLabel: { color: colors.mist, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  sourceName: { color: colors.snow, fontSize: 15, fontWeight: '700', marginTop: 3 },
  desc: { color: colors.mist, fontSize: 14, lineHeight: 21 },
  more: { color: colors.brand, fontSize: 12, fontWeight: '800', marginTop: 6 },
  views: { color: colors.mist, fontSize: 12, paddingHorizontal: 16, marginTop: 10 },
  upNext: { color: colors.snow, fontSize: 17, fontWeight: '900', paddingHorizontal: 16, marginBottom: 2 },
});

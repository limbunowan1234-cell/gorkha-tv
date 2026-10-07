import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch, formatCount } from '../api';
import { colors, spacing } from '../theme';
import VideoCard from '../components/VideoCard';
import YoutubePlayer from '../components/YoutubePlayer';

// Fire-and-forget, once per real screen visit — mirrors the website's own
// gorkhatv2/js/watch.js recordView(): never blocks rendering, never surfaces
// an error to the viewer.
function recordView(id) {
  fetch(`https://gorkhatv.site/api/videos/${encodeURIComponent(id)}/view`, { method: 'POST' }).catch(() => {});
}

export default function VideoScreen({ route, navigation }) {
  const { videoId, queue, queueIndex } = route.params;
  const [video, setVideo] = useState(null);
  const [related, setRelated] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const viewedRef = useRef(new Set());
  const advancedRef = useRef(false);

  // "Auto next": continues through whatever list this screen was opened
  // from (Top 10 row, a region row, or the full chart — see FeedScreen.js/
  // ChartScreen.js, which pass `queue`+`queueIndex` when navigating here).
  // Falls back to the first related video when there's no queue (e.g.
  // opened from a related-video tap) or the queue has run out — mirrors the
  // website's own gorkhatv2/js/watch.js maybeShowAutoplayOverlay(), just
  // without the countdown card (auto next fires immediately here).
  const nextInQueue = queue && queueIndex != null && queueIndex + 1 < queue.length ? queue[queueIndex + 1] : null;
  const nextVideo = nextInQueue || related[0] || null;
  // The visible "Up Next" list always matches what auto-advance will
  // actually do — a queue in progress takes priority over generic related
  // videos, same precedence the website's own watch.js gives its queue.
  const upNextList = nextInQueue ? queue.slice(queueIndex + 1) : related;

  const handleEnd = () => {
    if (!nextVideo || advancedRef.current) return;
    advancedRef.current = true;
    navigation.replace(
      'Video',
      nextInQueue
        ? { videoId: nextVideo.youtube_video_id, queue, queueIndex: queueIndex + 1 }
        : { videoId: nextVideo.youtube_video_id }
    );
  };

  useEffect(() => {
    let cancelled = false;
    setVideo(null);
    setNotFound(false);
    advancedRef.current = false; // each new video gets its own chance to auto-advance
    (async () => {
      try {
        const { video } = await apiFetch(`/videos/${encodeURIComponent(videoId)}`);
        if (cancelled) return;
        setVideo(video);
        if (!viewedRef.current.has(videoId)) {
          viewedRef.current.add(videoId);
          recordView(videoId);
        }
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

  if (notFound) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Video not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView>
        {/* videoId comes straight from route.params (available synchronously,
            unlike `video`, which needs the API fetch below to resolve) so
            YoutubePlayer's underlying WebView is never unmounted between
            videos — only its videoId prop changes. That's what lets the
            library's own loadVideoById() path (a live postMessage/
            injectJavaScript call on an already-loaded, already-interacted-
            with page) handle the switch, instead of a fresh WebView
            navigation — which is exactly the case most likely to get
            silently blocked by iOS's autoplay policy regardless of
            mediaPlaybackRequiresUserAction. Confirmed by reading the
            library's own source (node_modules/react-native-youtube-iframe/
            src/YoutubeIframe.js) rather than guessing. */}
        <YoutubePlayer videoId={videoId} onEnd={handleEnd} />

        {!video ? (
          <View style={styles.loadingInfo}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <View style={styles.info}>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.meta}>
              {[video.view_count ? `${formatCount(video.view_count)} views` : null, video.location].filter(Boolean).join(' · ')}
            </Text>
            <Pressable
              style={styles.channelRow}
              onPress={() => navigation.push('Creator', { channelId: video.channel_slug || video.youtube_channel_id })}
            >
              <Text style={styles.channelName}>{video.channel_name}</Text>
            </Pressable>
            {video.description ? <Text style={styles.description}>{video.description}</Text> : null}
          </View>
        )}

        {upNextList.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Up Next</Text>
            {upNextList.map((r, i) => (
              <VideoCard
                key={r.youtube_video_id}
                video={r}
                onPress={() =>
                  navigation.push(
                    'Video',
                    nextInQueue
                      ? { videoId: r.youtube_video_id, queue, queueIndex: queueIndex + 1 + i }
                      : { videoId: r.youtube_video_id }
                  )
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: colors.muted, fontSize: 14 },
  loadingInfo: { padding: spacing.lg, alignItems: 'center' },
  info: { padding: spacing.md },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  meta: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  channelRow: { marginTop: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  channelName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 13, marginTop: spacing.sm, lineHeight: 19 },
  relatedSection: { marginTop: spacing.md, paddingBottom: spacing.lg },
  relatedTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginLeft: spacing.md, marginBottom: spacing.xs },
});

import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import YoutubeIframe from 'react-native-youtube-iframe';
import { colors } from './theme';
import { ytThumb, formatCount } from './api';

const TAP_DELAY_MS = 250; // a second tap inside this window is a double-tap (save)

// One full-screen reel. Speed comes from three things working together:
//  1. the thumbnail is on screen the instant the slide scrolls in (it is a
//     plain Image, no network wait once prefetched),
//  2. the player for the NEXT reel is already mounted and loaded (paused)
//     while you watch the current one — `near` — so swiping just flips
//     `active` and playback starts from a warm WebView,
//  3. the thumbnail only fades away once the player reports it is truly
//     playing, so there is never a black flash between reels.
function Reel({ item, width, height, active, near, muted, saved, onToggleSave, onToggleMute }) {
  const playerRef = useRef(null);
  const thumbOpacity = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;
  const tapRef = useRef({ count: 0, timer: null });
  const [userPaused, setUserPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);

  // Player unmounted (swiped far away) → bring the thumbnail back so a later
  // return to this slide starts from the same instant-visible state.
  useEffect(() => {
    if (!near) {
      thumbOpacity.setValue(1);
      progress.setValue(0);
    }
  }, [near, thumbOpacity, progress]);

  useEffect(() => {
    if (!active) setUserPaused(false);
  }, [active]);

  // Progress: a mint line rising along the left edge as the reel plays.
  useEffect(() => {
    if (!active || !near) return undefined;
    const timer = setInterval(async () => {
      try {
        const [cur, dur] = await Promise.all([playerRef.current?.getCurrentTime(), playerRef.current?.getDuration()]);
        if (dur > 0) progress.setValue(Math.min(1, cur / dur));
      } catch {
        /* player not ready yet */
      }
    }, 400);
    return () => clearInterval(timer);
  }, [active, near, progress]);

  const burstHeart = () => {
    heart.setValue(0);
    Animated.sequence([
      Animated.timing(heart, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(heart, { toValue: 0, duration: 380, delay: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleTap = () => {
    const t = tapRef.current;
    t.count += 1;
    if (t.count === 1) {
      t.timer = setTimeout(() => {
        t.count = 0;
        setUserPaused((p) => !p);
        setShowPauseIcon(true);
        setTimeout(() => setShowPauseIcon(false), 450);
      }, TAP_DELAY_MS);
    } else {
      clearTimeout(t.timer);
      t.count = 0;
      burstHeart();
      if (!saved) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onToggleSave(item);
      }
    }
  };

  const heartScale = heart.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.2] });

  return (
    <View style={{ width, height, backgroundColor: colors.night }}>
      {near && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <YoutubeIframe
            ref={playerRef}
            width={width}
            height={height}
            videoId={item.youtube_video_id}
            play={active && !userPaused}
            mute={muted}
            initialPlayerParams={{ controls: false, modestbranding: true, rel: false, preventFullScreen: true }}
            webViewStyle={{ opacity: 0.99, backgroundColor: '#000' }}
            webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
            onChangeState={(state) => {
              if (state === 'playing') Animated.timing(thumbOpacity, { toValue: 0, duration: 160, useNativeDriver: true }).start();
              if (state === 'ended') playerRef.current?.seekTo(0, true);
            }}
          />
        </View>
      )}
      {/* thumbnail covers the player until it reports it is truly playing */}
      <Animated.Image source={{ uri: ytThumb(item) }} style={[StyleSheet.absoluteFill, { opacity: thumbOpacity }]} resizeMode="cover" pointerEvents="none" />

      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />

      <LinearGradient colors={['transparent', 'rgba(16,18,22,0.92)']} style={styles.scrim} pointerEvents="none" />

      <Animated.Text pointerEvents="none" style={[styles.heartBurst, { opacity: heart, transform: [{ scale: heartScale }] }]}>
        💚
      </Animated.Text>
      {showPauseIcon && (
        <View style={styles.pauseFlash} pointerEvents="none">
          <Text style={styles.pauseFlashText}>{userPaused ? '❚❚' : '▶'}</Text>
        </View>
      )}

      {/* progress line */}
      <View style={styles.progressTrack} pointerEvents="none">
        <Animated.View style={[styles.progressFill, { transform: [{ scaleY: progress }] }]} />
      </View>

      <View style={styles.actions}>
        <ActionButton
          icon={saved ? '💚' : '🤍'}
          label={saved ? 'Saved' : 'Save'}
          highlighted={saved}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onToggleSave(item);
          }}
        />
        <ActionButton icon={muted ? '🔇' : '🔊'} label={muted ? 'Muted' : 'Sound'} onPress={onToggleMute} />
        <ActionButton
          icon="↗"
          label="Share"
          onPress={() => Share.share({ message: `${item.title}\nhttps://gorkhatv.site/shorts/${item.youtube_video_id}` }).catch(() => {})}
        />
        <ActionButton icon="▶" label="YouTube" onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${item.youtube_video_id}`)} />
      </View>

      {/* the template's own bottom card (brand-pack ukaali-reel-cover) */}
      <View style={styles.infoWrap} pointerEvents="none">
        <View style={styles.infoCard}>
          <Text style={styles.creator} numberOfLines={1}>
            @{(item.channel_handle || item.channel_name || 'creator').replace(/^@/, '')}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.category, item.location, item.view_count ? `${formatCount(item.view_count)} views` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ActionButton({ icon, label, onPress, highlighted }) {
  return (
    <Pressable onPress={onPress} style={styles.actionWrap} hitSlop={6}>
      <View style={[styles.actionBtn, highlighted && styles.actionBtnOn]}>
        <Text style={styles.actionIcon}>{icon}</Text>
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' },
  heartBurst: { position: 'absolute', alignSelf: 'center', top: '40%', fontSize: 96 },
  pauseFlash: {
    position: 'absolute', alignSelf: 'center', top: '44%', width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(16,18,22,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  pauseFlashText: { color: colors.snow, fontSize: 24 },
  progressTrack: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(244,241,234,0.08)', justifyContent: 'flex-end' },
  progressFill: { width: 3, height: '100%', backgroundColor: colors.brand, transformOrigin: 'bottom' },
  actions: { position: 'absolute', right: 10, bottom: 26, alignItems: 'center', gap: 14 },
  actionWrap: { alignItems: 'center' },
  actionBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(16,18,22,0.55)', alignItems: 'center', justifyContent: 'center' },
  actionBtnOn: { backgroundColor: colors.brandTint, borderWidth: 1.5, borderColor: colors.brand },
  actionIcon: { color: colors.snow, fontSize: 20 },
  actionLabel: { color: colors.snow, fontSize: 10, marginTop: 3, fontWeight: '600' },
  infoWrap: { position: 'absolute', left: 14, right: 80, bottom: 22 },
  infoCard: { backgroundColor: 'rgba(16,18,22,0.78)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, alignSelf: 'flex-start', maxWidth: '100%' },
  creator: { color: colors.brand, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  title: { color: colors.snow, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta: { color: colors.mist, fontSize: 11, marginTop: 6 },
});

export default memo(Reel);

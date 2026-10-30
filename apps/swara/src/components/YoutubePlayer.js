import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { PLAYER_ORIGIN } from '../api';

// Thin wrapper around react-native-youtube-iframe: the real embedded YouTube
// player (this project never extracts or rehosts audio or video). The parent
// owns `playing` so SWARA's own controls (sleep timer, waveform) can drive and
// follow it.
export default function YoutubePlayer({ videoId, playing, setPlaying, onEnd, onPlayingChange, width }) {
  const [error, setError] = useState(null);
  // Auto-next swaps the videoId on this same instance (no remount), so a
  // `playing=false` left over from the previous song's 'ended' would silently
  // block the next one — force it back on whenever the video changes.
  useEffect(() => {
    setPlaying(true);
    setError(null);
  }, [videoId, setPlaying]);

  return (
    <View style={styles.wrap}>
      <YoutubeIframe
        height={Math.round((width || 340) * 9 / 16)}
        width={width}
        videoId={videoId}
        play={playing}
        onChangeState={(state) => {
          if (state === 'playing') onPlayingChange?.(true);
          if (state === 'paused') onPlayingChange?.(false);
          if (state === 'ended') {
            setPlaying(false);
            onPlayingChange?.(false);
            onEnd?.();
          }
        }}
        useLocalHTML
        baseUrlOverride={PLAYER_ORIGIN}
        onError={(e) => setError(e || 'error')}
        webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
      />
      {error ? (
        <Pressable style={styles.fail} onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`)}>
          <Text style={styles.failText}>Can’t play here ({String(error)}). Tap to open on YouTube</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  fail: { padding: 12, backgroundColor: '#1B1F26' },
  failText: { color: '#F4F1EA', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';

// Thin wrapper around react-native-youtube-iframe: the real embedded YouTube
// player (this project never extracts or rehosts audio or video). The parent
// owns `playing` so SWARA's own controls (sleep timer, waveform) can drive and
// follow it.
export default function YoutubePlayer({ videoId, playing, setPlaying, onEnd, onPlayingChange, width }) {
  // Auto-next swaps the videoId on this same instance (no remount), so a
  // `playing=false` left over from the previous song's 'ended' would silently
  // block the next one — force it back on whenever the video changes.
  useEffect(() => {
    setPlaying(true);
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
        webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
});

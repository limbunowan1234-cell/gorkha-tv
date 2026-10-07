import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { colors } from '../theme';

// Thin wrapper around react-native-youtube-iframe — the standard,
// Expo-compatible RN player for the real YouTube IFrame Player API (this
// project never extracts/rehosts audio or video; the actual playback is
// always the real embedded YouTube player, same hard rule the website
// itself follows). Uses a WebView internally (confirmed via its own docs),
// so the background-audio question is identical to the website's own — the
// already-committed expo-audio enableBackgroundPlayback config is an
// app-level OS entitlement, not tied to this specific player component.
export default function YoutubePlayer({ videoId, onEnd }) {
  const [playing, setPlaying] = useState(true);

  // Auto next calls navigation.replace() with a new videoId — React reuses
  // this same component instance rather than remounting it, so `playing`
  // would otherwise stay `false` from when the PREVIOUS video's 'ended'
  // state set it, silently blocking the next video from autoplaying. Force
  // it back to true whenever the video changes.
  useEffect(() => {
    setPlaying(true);
  }, [videoId]);

  return (
    <View style={styles.wrap}>
      <YoutubeIframe
        height={220}
        videoId={videoId}
        play={playing}
        onChangeState={(state) => {
          if (state === 'ended') {
            setPlaying(false);
            onEnd?.();
          }
        }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: colors.background,
  },
});

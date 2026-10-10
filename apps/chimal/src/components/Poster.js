import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ytThumb, formatDuration } from '../api';
import { colors } from '../theme';

// A title as a poster: tall card, key art cropped to fill, title over a scrim.
// `progress` (0..1) draws a thin amber bar for Continue watching.
export default function Poster({ video, onPress, width = 132, progress }) {
  const height = Math.round(width * 1.5);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width, marginHorizontal: 5 }, pressed && { opacity: 0.75 }]}>
      <View style={[styles.card, { width, height }]}>
        <Image source={{ uri: ytThumb(video) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(16,18,22,0.95)']} style={styles.scrim} />
        {video.duration_seconds ? (
          <View style={styles.dur}>
            <Text style={styles.durText}>{formatDuration(video.duration_seconds)}</Text>
          </View>
        ) : null}
        <Text style={styles.title} numberOfLines={3}>
          {video.title}
        </Text>
        {progress != null && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.slate, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  title: { color: colors.snow, fontSize: 12, fontWeight: '800', lineHeight: 15, padding: 8, paddingBottom: 10 },
  dur: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(16,18,22,0.75)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  durText: { color: colors.snow, fontSize: 10, fontWeight: '700' },
  barTrack: { height: 3, backgroundColor: 'rgba(244,241,234,0.25)' },
  barFill: { height: 3, backgroundColor: colors.brand },
});

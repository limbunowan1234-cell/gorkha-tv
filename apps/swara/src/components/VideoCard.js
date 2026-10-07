import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ytThumb, formatCount } from '../api';
import { colors, spacing } from '../theme';

// Used by every list/grid in this app (FeedScreen rows, ChartScreen list,
// CreatorScreen grid) — a numbered rank is optional (chart/top-10 rows only).
export default function VideoCard({ video, onPress, rank, horizontal }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, horizontal ? styles.cardHorizontal : styles.cardVertical]}
    >
      {rank != null && <Text style={styles.rank}>{rank}</Text>}
      <Image source={{ uri: ytThumb(video) }} style={styles.thumb} resizeMode="cover" />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {[video.channel_name, video.view_count ? `${formatCount(video.view_count)} views` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  cardHorizontal: {
    width: 220,
  },
  cardVertical: {
    width: '100%',
  },
  rank: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
  },
  thumb: {
    width: 120,
    aspectRatio: 16 / 9,
    borderRadius: 4,
    backgroundColor: colors.surface2,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  sub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
});

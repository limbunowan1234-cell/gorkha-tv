import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ytThumb, formatCount } from '../api';
import { colors } from '../theme';

// A song as a row: square cover, title, artist, plays. `rank` turns it into a
// chart row with a big numeral; `right` lets a screen add its own control.
export default function SongRow({ song, rank, onPress, right }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      {rank != null && <Text style={[styles.rank, rank <= 3 && styles.rankTop]}>{rank}</Text>}
      <Image source={{ uri: ytThumb(song) }} style={styles.cover} resizeMode="cover" />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {song.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {[song.channel_name, song.view_count ? `${formatCount(song.view_count)} plays` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, gap: 12 },
  rank: { width: 34, textAlign: 'center', color: colors.mist, fontSize: 22, fontWeight: '800' },
  rankTop: { color: colors.brand, fontSize: 28 },
  cover: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.slate },
  info: { flex: 1, minWidth: 0 },
  title: { color: colors.snow, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  artist: { color: colors.mist, fontSize: 12, marginTop: 3 },
});

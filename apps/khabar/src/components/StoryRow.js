import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ytThumb, timeAgo, isFresh } from '../api';
import { colors } from '../theme';

// A story as a headline row: the headline leads (that is the news), the
// source and age sit under it, a small thumbnail on the right. Fresh stories
// carry a BREAKING tag.
export default function StoryRow({ story, onPress, right }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.text}>
        {isFresh(story.published_at) && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>BREAKING</Text>
          </View>
        )}
        <Text style={styles.headline} numberOfLines={4}>
          {story.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[story.channel_name, timeAgo(story.published_at), story.location].filter(Boolean).join('  ·  ')}
        </Text>
      </View>
      <Image source={{ uri: ytThumb(story) }} style={styles.thumb} resizeMode="cover" />
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(244,241,234,0.12)' },
  text: { flex: 1, minWidth: 0 },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.breaking, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 6 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  headline: { color: colors.snow, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  meta: { color: colors.mist, fontSize: 12, marginTop: 7 },
  thumb: { width: 92, height: 92, borderRadius: 8, backgroundColor: colors.slate },
});

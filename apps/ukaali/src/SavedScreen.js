import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';
import { ytThumb } from './api';
import { useSaved } from './storage';

// Your trail: every reel you saved, kept on this phone.
export default function SavedScreen({ navigation }) {
  const saved = useSaved();
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.heading}>Your trail</Text>
      <Text style={styles.sub}>{saved.length ? `${saved.length} saved on this phone` : 'Reels you save stay here.'}</Text>
      <FlatList
        data={saved}
        numColumns={2}
        keyExtractor={(r) => r.youtube_video_id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: 10 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏔️</Text>
            <Text style={styles.emptyText}>Tap the heart, or double-tap a reel, to keep it. Your trail starts with the first one.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable style={styles.tile} onPress={() => navigation.navigate('Watch', { items: saved, index })}>
            <Image source={{ uri: ytThumb(item) }} style={styles.thumb} resizeMode="cover" />
            <Text style={styles.tileTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  heading: { color: colors.snow, fontSize: 26, fontWeight: '800', paddingHorizontal: 16, paddingTop: 12 },
  sub: { color: colors.mist, fontSize: 13, paddingHorizontal: 16, marginTop: 2, marginBottom: 12 },
  grid: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  tile: { flex: 1 },
  thumb: { width: '100%', aspectRatio: 9 / 14, borderRadius: 14, backgroundColor: colors.slate },
  tileTitle: { color: colors.snow, fontSize: 12, fontWeight: '600', marginTop: 6, lineHeight: 16 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 44 },
  emptyText: { color: colors.mist, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 12 },
});

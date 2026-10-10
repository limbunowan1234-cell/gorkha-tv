import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { likedSongs, recentSongs } from '../storage';
import SongRow from '../components/SongRow';

// Your library, kept on this phone: the songs you hearted and what you
// played lately.
export default function LibraryScreen({ navigation }) {
  const [tab, setTab] = useState('liked');
  const liked = likedSongs.useList();
  const recent = recentSongs.useList();
  const list = tab === 'liked' ? liked : recent;

  const play = (index) => navigation.navigate('Player', { videoId: list[index].youtube_video_id, queue: list, queueIndex: index });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.heading}>Your library</Text>
      <View style={styles.tabs}>
        {[
          ['liked', `Liked · ${liked.length}`],
          ['recent', 'Recently played'],
        ].map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabOn]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(s) => s.youtube_video_id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎙️</Text>
            <Text style={styles.emptyText}>
              {tab === 'liked' ? 'Tap the heart on a song and it will live here.' : 'Songs you play will show up here.'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => <SongRow song={item} onPress={() => play(index)} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  heading: { color: colors.snow, fontSize: 26, fontWeight: '900', paddingHorizontal: 16, paddingTop: 12 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginVertical: 14 },
  tab: { paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(230,71,157,0.45)', backgroundColor: colors.brandTint },
  tabOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  tabTextOn: { color: colors.night },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 36 },
  emptyIcon: { fontSize: 44 },
  emptyText: { color: colors.mist, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 12 },
});

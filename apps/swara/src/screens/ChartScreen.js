import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../api';
import { colors } from '../theme';
import SongRow from '../components/SongRow';

// Top 100 Hills Hits, ranked by real engagement across the whole catalog.
export default function ChartScreen({ navigation }) {
  const [chart, setChart] = useState(null);

  useEffect(() => {
    apiFetch('/chart')
      .then(({ chart }) => setChart(chart || []))
      .catch(() => setChart([]));
  }, []);

  if (chart === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const play = (index) => navigation.navigate('Player', { videoId: chart[index].youtube_video_id, queue: chart, queueIndex: index });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={chart}
        keyExtractor={(v) => v.youtube_video_id}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.heading}>Top 100 Hills Hits</Text>
            <Text style={styles.sub}>The songs the hills are really playing.</Text>
            <Pressable style={styles.playAll} onPress={() => chart.length && play(0)}>
              <Text style={styles.playAllText}>▶  Play all</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => <SongRow song={item} rank={index + 1} onPress={() => play(index)} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  head: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  heading: { color: colors.snow, fontSize: 26, fontWeight: '900' },
  sub: { color: colors.mist, fontSize: 13, marginTop: 4 },
  playAll: { alignSelf: 'flex-start', marginTop: 14, backgroundColor: colors.brand, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 10 },
  playAllText: { color: colors.night, fontSize: 13, fontWeight: '900' },
});

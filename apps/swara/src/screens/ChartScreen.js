import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../api';
import { colors } from '../theme';
import VideoCard from '../components/VideoCard';

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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={chart}
        keyExtractor={(v) => v.youtube_video_id}
        renderItem={({ item, index }) => (
          <VideoCard
            video={item}
            rank={index + 1}
            onPress={() => navigation.navigate('Video', { videoId: item.youtube_video_id, queue: chart, queueIndex: index })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});

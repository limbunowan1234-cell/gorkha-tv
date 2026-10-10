import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { myList } from '../storage';
import Poster from '../components/Poster';

// My List: titles you saved, kept on this phone.
export default function MyListScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const list = myList.use();
  const cols = 3;
  const cardW = Math.floor((width - 16 * 2 - 10 * (cols - 1)) / cols);
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.heading}>My List</Text>
      <Text style={styles.sub}>{list.length ? `${list.length} saved on this phone` : 'Your watchlist'}</Text>
      <FlatList
        key={cols}
        data={list}
        numColumns={cols}
        keyExtractor={(v) => v.youtube_video_id}
        contentContainerStyle={{ paddingHorizontal: 11, paddingBottom: 24 }}
        columnWrapperStyle={{ marginBottom: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎞️</Text>
            <Text style={styles.emptyText}>Tap “+ My List” on any title and it waits for you here.</Text>
          </View>
        }
        renderItem={({ item }) => <Poster video={item} width={cardW} onPress={() => navigation.navigate('Title', { video: item })} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  heading: { color: colors.snow, fontSize: 26, fontWeight: '900', paddingHorizontal: 16, paddingTop: 12 },
  sub: { color: colors.mist, fontSize: 13, paddingHorizontal: 16, marginTop: 2, marginBottom: 14 },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 36 },
  emptyIcon: { fontSize: 44 },
  emptyText: { color: colors.mist, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 12 },
});

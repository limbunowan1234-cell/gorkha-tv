import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchCategory } from '../api';
import { colors, CATEGORIES } from '../theme';
import Poster from '../components/Poster';

// Browse by category: a grid of posters. Magic sits in the chips like any
// other category (it mixes long-form and Shorts, newest first).
export default function BrowseScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState(route.params?.category || CATEGORIES[0].slug);
  const [items, setItems] = useState(null);

  // Opened from a row's "See all" while this tab is already mounted
  useEffect(() => {
    if (route.params?.category) setCategory(route.params.category);
  }, [route.params?.category]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    fetchCategory(category, 40).then((list) => !cancelled && setItems(list));
    return () => {
      cancelled = true;
    };
  }, [category]);

  const cols = 3;
  const cardW = Math.floor((width - 16 * 2 - 10 * (cols - 1)) / cols);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.heading}>Browse</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
        {CATEGORIES.map((c) => {
          const on = c.slug === category;
          return (
            <Pressable key={c.slug} onPress={() => setCategory(c.slug)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.slug === 'magic' ? '🪄 ' : ''}{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {items === null ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          key={cols}
          data={items}
          numColumns={cols}
          keyExtractor={(v) => v.youtube_video_id}
          contentContainerStyle={{ paddingHorizontal: 11, paddingBottom: 24 }}
          columnWrapperStyle={{ marginBottom: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>Nothing here yet. New titles land often, so check back soon.</Text>}
          renderItem={({ item }) => <Poster video={item} width={cardW} onPress={() => navigation.navigate('Title', { video: item })} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  heading: { color: colors.snow, fontSize: 26, fontWeight: '900', paddingHorizontal: 16, paddingTop: 12 },
  chipScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: 16, gap: 8, paddingVertical: 14 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(232,166,42,0.45)', backgroundColor: colors.brandTint },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  chipTextOn: { color: colors.night },
  empty: { color: colors.mist, textAlign: 'center', padding: 32, lineHeight: 21 },
});

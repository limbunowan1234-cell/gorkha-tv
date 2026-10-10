import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchNews, searchNews, ytThumb, timeAgo, isFresh } from '../api';
import { colors, TAGLINE } from '../theme';
import StoryRow from '../components/StoryRow';

// Top stories: newest first. The lead story gets the picture; "Play bulletin"
// runs the headlines back to back like a news broadcast; search finds
// stories by keyword (news only).
export default function TopScreen({ navigation }) {
  const [stories, setStories] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const debounce = useRef(null);

  const load = useCallback(async () => {
    try {
      setStories(await fetchNews({ limit: 40 }));
    } catch {
      setStories((s) => s || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults(null);
      return undefined;
    }
    debounce.current = setTimeout(() => {
      searchNews(query.trim())
        .then(setResults)
        .catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [query]);

  if (stories === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const searching = results !== null;
  const list = searching ? results : stories;
  const lead = !searching ? stories[0] : null;
  const rest = !searching ? stories.slice(1) : results;

  const open = (index, source, bulletin = false) => navigation.navigate('Story', { story: source[index], queue: source, queueIndex: index, bulletin });

  const header = (
    <View>
      <View style={styles.top}>
        <View>
          <Text style={styles.logo}>KHABAR</Text>
          <Text style={styles.tagline}>{TAGLINE}</Text>
        </View>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search the news"
        placeholderTextColor={colors.mist}
        style={styles.search}
        returnKeyType="search"
        autoCorrect={false}
      />
      {!searching && stories.length > 0 && (
        <Pressable style={styles.bulletin} onPress={() => open(0, stories, true)}>
          <Text style={styles.bulletinText}>▶  Play bulletin</Text>
          <Text style={styles.bulletinSub}>Headlines, one after another</Text>
        </Pressable>
      )}
      {lead && (
        <Pressable style={styles.lead} onPress={() => open(0, stories)}>
          <Image source={{ uri: ytThumb(lead) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(16,18,22,0.97)']} style={StyleSheet.absoluteFill} />
          <View style={styles.leadBody}>
            {isFresh(lead.published_at) && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>BREAKING</Text>
              </View>
            )}
            <Text style={styles.leadTitle} numberOfLines={4}>
              {lead.title}
            </Text>
            <Text style={styles.leadMeta}>{[lead.channel_name, timeAgo(lead.published_at)].filter(Boolean).join('  ·  ')}</Text>
          </View>
        </Pressable>
      )}
      {searching && <Text style={styles.resultsNote}>{results.length ? `${results.length} stories` : 'No stories match that search.'}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={rest}
        keyExtractor={(s) => s.youtube_video_id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.brand}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item, index }) => <StoryRow story={item} onPress={() => open(searching ? index : index + 1, list)} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  top: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  logo: { color: colors.brand, fontSize: 30, fontWeight: '900', letterSpacing: 2 },
  tagline: { color: colors.mist, fontSize: 12, marginTop: 2, letterSpacing: 0.6 },
  search: { marginHorizontal: 16, height: 42, borderRadius: 10, backgroundColor: colors.slate, color: colors.snow, paddingHorizontal: 14, fontSize: 14 },
  bulletin: { marginHorizontal: 16, marginTop: 12, borderRadius: 10, backgroundColor: colors.brandTint, borderWidth: 1.5, borderColor: colors.brand, paddingVertical: 12, paddingHorizontal: 16 },
  bulletinText: { color: colors.brand, fontSize: 15, fontWeight: '900' },
  bulletinSub: { color: colors.mist, fontSize: 12, marginTop: 2 },
  lead: { marginHorizontal: 16, marginTop: 14, height: 250, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.slate, justifyContent: 'flex-end' },
  leadBody: { padding: 16 },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.breaking, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 8 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  leadTitle: { color: colors.snow, fontSize: 21, fontWeight: '900', lineHeight: 27 },
  leadMeta: { color: colors.mist, fontSize: 12, marginTop: 8 },
  resultsNote: { color: colors.mist, fontSize: 12, paddingHorizontal: 16, paddingVertical: 12 },
});

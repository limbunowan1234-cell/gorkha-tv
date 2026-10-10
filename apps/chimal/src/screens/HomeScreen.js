import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchCategory, ytThumb, formatCount, formatDuration } from '../api';
import { colors, CATEGORIES, TAGLINE } from '../theme';
import { myList, progress, continueList } from '../storage';
import Poster from '../components/Poster';

// Home: a hero carousel of what is hot, Continue watching (kept on the
// phone), then one poster row per category. Magic gets its own row too.
export default function HomeScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const [rows, setRows] = useState(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroRef = useRef(null);
  const saved = myList.use();
  const progressMap = progress.use();
  const cont = continueList(progressMap);

  useEffect(() => {
    let cancelled = false;
    Promise.all(CATEGORIES.map((c) => fetchCategory(c.slug, 14))).then((lists) => {
      if (!cancelled) setRows(CATEGORIES.map((c, i) => ({ ...c, items: lists[i] })).filter((r) => r.items.length));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const heroes = rows
    ? rows
        .filter((r) => r.slug !== 'magic')
        .flatMap((r) => r.items.slice(0, 2))
        .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 5)
    : [];

  // Auto-rotate the hero every 5 seconds.
  useEffect(() => {
    if (heroes.length < 2) return undefined;
    const t = setInterval(() => {
      setHeroIndex((i) => {
        const next = (i + 1) % heroes.length;
        heroRef.current?.scrollToOffset({ offset: next * width, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [heroes.length, width]);

  const open = (video) => navigation.navigate('Title', { video });

  if (!rows) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  // tall and cinematic, but never more than two thirds of the screen so the
  // buttons always stay in view
  const heroHeight = Math.min(Math.round(width * 1.2), Math.round(height * 0.66));

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ height: heroHeight }}>
          <FlatList
            ref={heroRef}
            data={heroes}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(v) => v.youtube_video_id}
            onMomentumScrollEnd={(e) => setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={({ item }) => {
              const inList = saved.some((s) => s.youtube_video_id === item.youtube_video_id);
              return (
                <Pressable style={{ width, height: heroHeight }} onPress={() => open(item)}>
                  <Image source={{ uri: ytThumb(item) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <LinearGradient colors={['rgba(16,18,22,0.35)', 'transparent', 'rgba(16,18,22,0.98)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
                  <View style={styles.heroBody}>
                    <Text style={styles.eyebrow}>CHIMAL  ·  {String(item.category || '').toUpperCase()}</Text>
                    <Text style={styles.heroTitle} numberOfLines={3}>
                      {item.title}
                    </Text>
                    <Text style={styles.heroMeta}>
                      {[item.channel_name, formatDuration(item.duration_seconds), item.view_count ? `${formatCount(item.view_count)} views` : null].filter(Boolean).join('  ·  ')}
                    </Text>
                    <View style={styles.heroBtns}>
                      <View style={styles.watchBtn}>
                        <Text style={styles.watchText}>▶  Watch</Text>
                      </View>
                      <Pressable style={styles.listBtn} onPress={() => myList.toggle(item)}>
                        <Text style={styles.listText}>{inList ? '✓ In My List' : '+ My List'}</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
          <View style={styles.dots} pointerEvents="none">
            {heroes.map((_, i) => (
              <View key={i} style={[styles.dot, i === heroIndex && styles.dotOn]} />
            ))}
          </View>
        </View>

        <Text style={styles.tagline}>{TAGLINE}</Text>

        {cont.length > 0 && (
          <Row title="Continue watching">
            {cont.map((p) => (
              <Poster key={p.item.youtube_video_id} video={p.item} progress={p.seconds / p.duration} onPress={() => open(p.item)} />
            ))}
          </Row>
        )}

        {rows.map((r) => (
          <Row key={r.slug} title={r.slug === 'magic' ? '🪄 Magic' : r.label} action="See all" onAction={() => navigation.navigate('Browse', { category: r.slug })}>
            {r.items.map((v) => (
              <Poster key={v.youtube_video_id} video={v} onPress={() => open(v)} />
            ))}
          </Row>
        ))}
        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ title, action, onAction, children }) {
  return (
    <View style={{ marginTop: 22 }}>
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle}>{title}</Text>
        {action ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={styles.rowAction}>{action} ›</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 11 }}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  heroBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, paddingBottom: 34 },
  eyebrow: { color: colors.brand, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: colors.snow, fontSize: 26, fontWeight: '900', lineHeight: 31, marginTop: 8 },
  heroMeta: { color: colors.mist, fontSize: 12, marginTop: 8 },
  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  watchBtn: { backgroundColor: colors.snow, borderRadius: 8, paddingHorizontal: 22, paddingVertical: 11 },
  watchText: { color: colors.night, fontSize: 14, fontWeight: '900' },
  listBtn: { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11, borderWidth: 1.5, borderColor: 'rgba(244,241,234,0.5)', backgroundColor: 'rgba(16,18,22,0.5)' },
  listText: { color: colors.snow, fontSize: 14, fontWeight: '800' },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(244,241,234,0.35)' },
  dotOn: { backgroundColor: colors.brand, width: 18 },
  tagline: { color: colors.mist, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center', marginTop: 14 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16, marginBottom: 10 },
  rowTitle: { color: colors.snow, fontSize: 18, fontWeight: '900' },
  rowAction: { color: colors.brand, fontSize: 12, fontWeight: '800' },
});

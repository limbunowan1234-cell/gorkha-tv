import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';
import { postShortsEvent, ytThumb, recordView } from './api';
import { toggleSaved, useSaved } from './storage';
import Reel from './Reel';

// Vertical, paged reel feed. Swipe speed notes:
//  - the active slide is derived from the live scroll offset (not from
//    FlatList's viewability callbacks, which fire late), so the new reel is
//    marked active — and starts playing — as soon as it crosses the halfway
//    point of the swipe;
//  - only the active reel and its two neighbours mount a player (`near`);
//  - the next few thumbnails are prefetched into the image cache.
export default function ReelFeed({ items, initialIndex = 0, onNeedMore, loading, header, emptyText }) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [active, setActive] = useState(initialIndex);
  const [muted, setMuted] = useState(false);
  const saved = useSaved();
  const listRef = useRef(null);
  const activeRef = useRef(initialIndex);
  const activatedAt = useRef(Date.now());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const savedIds = new Set(saved.map((r) => r.youtube_video_id));

  // Dwell tracking: leaving a reel in under 3s is a skip; staying for most of
  // it counts as a full watch — the same signal the website's feed sends.
  const settleDwell = useCallback((index) => {
    const item = itemsRef.current[index];
    if (!item) return;
    const secs = (Date.now() - activatedAt.current) / 1000;
    const full = item.duration_seconds ? item.duration_seconds * 0.8 : 8;
    if (secs < 3) postShortsEvent(item, 'skipped');
    else if (secs >= full) postShortsEvent(item, 'watched_full');
  }, []);

  const activate = useCallback(
    (index) => {
      if (index === activeRef.current || index < 0 || index >= itemsRef.current.length) return;
      settleDwell(activeRef.current);
      activeRef.current = index;
      activatedAt.current = Date.now();
      setActive(index);
      const item = itemsRef.current[index];
      if (item) recordView(item.youtube_video_id);
      for (let i = index + 1; i <= index + 3; i += 1) {
        const next = itemsRef.current[i];
        if (next) Image.prefetch(ytThumb(next)).catch(() => {});
      }
      if (index >= itemsRef.current.length - 3) onNeedMore?.();
    },
    [onNeedMore, settleDwell]
  );

  useEffect(() => {
    // fresh list (e.g. a category chip changed) → back to the first reel
    activeRef.current = initialIndex;
    activatedAt.current = Date.now();
    setActive(initialIndex);
    for (let i = initialIndex; i < initialIndex + 3; i += 1) {
      const it = items[i];
      if (it) Image.prefetch(ytThumb(it)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length === 0 ? 0 : items[0]?.youtube_video_id]);

  const onScroll = useCallback(
    (e) => {
      if (!size.height) return;
      activate(Math.round(e.nativeEvent.contentOffset.y / size.height));
    },
    [activate, size.height]
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <Reel
        item={item}
        width={size.width}
        height={size.height}
        active={index === active}
        near={Math.abs(index - active) <= 1}
        muted={muted}
        saved={savedIds.has(item.youtube_video_id)}
        onToggleSave={toggleSaved}
        onToggleMute={() => setMuted((m) => !m)}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size.width, size.height, active, muted, saved]
  );

  return (
    <View style={styles.root} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      {size.height > 0 && items.length > 0 && (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(it) => it.youtube_video_id}
          renderItem={renderItem}
          extraData={active}
          pagingEnabled
          snapToInterval={size.height}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: size.height, offset: size.height * index, index })}
          initialScrollIndex={Math.min(initialIndex, Math.max(0, items.length - 1))}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onEndReachedThreshold={2}
          onEndReached={() => onNeedMore?.()}
        />
      )}

      {items.length === 0 && (
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={colors.brand} size="large" /> : <Text style={styles.empty}>{emptyText || 'No reels here yet.'}</Text>}
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        {header}
      </View>
    </View>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { color: colors.mist, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  chips: { paddingHorizontal: 14, gap: 8, alignItems: 'center' },
  chip: {
    height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center',
    backgroundColor: 'rgba(16,18,22,0.6)', borderWidth: 1.5, borderColor: 'rgba(43,209,155,0.45)',
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  chipTextOn: { color: colors.night },
});

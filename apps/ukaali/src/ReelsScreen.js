import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { apiFetch } from './api';
import ReelFeed, { Chips } from './ReelFeed';
import { colors } from './theme';

// "Magic" is a first-class category now (see the site's migration 021);
// the rest are the other short-friendly categories.
const CHIPS = [
  { label: 'All', value: '' },
  { label: 'Magic', value: 'magic' },
  { label: 'Comedy', value: 'comedy' },
  { label: 'Vlogs', value: 'vlogs' },
  { label: 'Travel', value: 'travel' },
  { label: 'Music', value: 'music' },
  { label: 'News', value: 'news' },
  { label: 'Food', value: 'food' },
];

export default function ReelsScreen() {
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const cursorRef = useRef(null);
  const busyRef = useRef(false);
  const doneRef = useRef(false);
  const catRef = useRef('');

  const fetchPage = useCallback(async (reset) => {
    if (busyRef.current || (!reset && doneRef.current)) return;
    busyRef.current = true;
    const cat = catRef.current;
    try {
      const qs = ['limit=10', !reset && cursorRef.current ? `cursor=${encodeURIComponent(cursorRef.current)}` : '', cat ? `category=${cat}` : '']
        .filter(Boolean)
        .join('&');
      const { shorts, nextCursor } = await apiFetch(`/shorts?${qs}`);
      if (cat !== catRef.current) return; // chip changed while this was in flight
      cursorRef.current = nextCursor;
      doneRef.current = !nextCursor;
      setItems((prev) => {
        const base = reset ? [] : prev;
        const seen = new Set(base.map((s) => s.youtube_video_id));
        return [...base, ...shorts.filter((s) => !seen.has(s.youtube_video_id))];
      });
    } catch {
      /* transient — the next scroll near the end retries */
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    catRef.current = category;
    cursorRef.current = null;
    doneRef.current = false;
    busyRef.current = false;
    setItems([]);
    setLoading(true);
    fetchPage(true);
  }, [category, fetchPage]);

  return (
    <View style={styles.root}>
      <ReelFeed
        items={items}
        loading={loading}
        onNeedMore={() => fetchPage(false)}
        emptyText={category ? `No ${category} reels yet.\nCheck back soon.` : 'No reels yet.'}
        header={<Chips options={CHIPS} value={category} onChange={setCategory} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.night } });

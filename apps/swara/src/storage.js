import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// A small list kept on the phone (no sign-in). Each store has its own key,
// an in-memory cache, and listeners so every screen stays in sync.
function createListStore(key, max) {
  let list = null;
  const listeners = new Set();

  async function load() {
    if (list) return list;
    try {
      list = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
    } catch {
      list = [];
    }
    return list;
  }
  function commit(next) {
    list = next.slice(0, max);
    AsyncStorage.setItem(key, JSON.stringify(list)).catch(() => {});
    listeners.forEach((fn) => fn(list));
  }

  return {
    async toggle(item) {
      const cur = await load();
      const has = cur.some((x) => x.youtube_video_id === item.youtube_video_id);
      commit(has ? cur.filter((x) => x.youtube_video_id !== item.youtube_video_id) : [{ ...item, savedAt: Date.now() }, ...cur]);
      return !has;
    },
    // Newest first, no duplicates — used for "recently played".
    async push(item) {
      const cur = await load();
      commit([{ ...item, savedAt: Date.now() }, ...cur.filter((x) => x.youtube_video_id !== item.youtube_video_id)]);
    },
    useList() {
      const [value, setValue] = useState(list || []);
      useEffect(() => {
        let alive = true;
        load().then((l) => alive && setValue(l));
        listeners.add(setValue);
        return () => {
          alive = false;
          listeners.delete(setValue);
        };
      }, []);
      return value;
    },
  };
}

export const likedSongs = createListStore('swara_liked_v1', 500);
export const recentSongs = createListStore('swara_recent_v1', 30);

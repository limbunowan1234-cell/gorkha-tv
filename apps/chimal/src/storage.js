import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Everything here lives on the phone (no sign-in): My List, and where you
// stopped in each title so "Continue watching" can pick it back up.
function createStore(key, fallback) {
  let value = null;
  const listeners = new Set();
  async function load() {
    if (value !== null) return value;
    try {
      const raw = await AsyncStorage.getItem(key);
      value = raw ? JSON.parse(raw) : fallback;
    } catch {
      value = fallback;
    }
    return value;
  }
  function commit(next) {
    value = next;
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
    listeners.forEach((fn) => fn(value));
  }
  function use() {
    const [v, setV] = useState(value ?? fallback);
    useEffect(() => {
      let alive = true;
      load().then((x) => alive && setV(x));
      listeners.add(setV);
      return () => {
        alive = false;
        listeners.delete(setV);
      };
    }, []);
    return v;
  }
  return { load, commit, use };
}

const listStore = createStore('chimal_mylist_v1', []);
const progressStore = createStore('chimal_progress_v1', {});

export const myList = {
  use: listStore.use,
  async toggle(item) {
    const cur = await listStore.load();
    const has = cur.some((x) => x.youtube_video_id === item.youtube_video_id);
    listStore.commit(has ? cur.filter((x) => x.youtube_video_id !== item.youtube_video_id) : [{ ...item, savedAt: Date.now() }, ...cur]);
  },
};

export const progress = {
  use: progressStore.use,
  async save(item, seconds, duration) {
    if (!duration || seconds < 5) return;
    const cur = await progressStore.load();
    progressStore.commit({ ...cur, [item.youtube_video_id]: { item, seconds, duration, updatedAt: Date.now() } });
  },
  async get(id) {
    const cur = await progressStore.load();
    return cur[id] || null;
  },
  async clear(id) {
    const cur = await progressStore.load();
    const { [id]: _drop, ...rest } = cur;
    progressStore.commit(rest);
  },
};

// Titles you started but didn't finish (more than 10s in, less than 92%), newest first.
export function continueList(map) {
  return Object.values(map)
    .filter((p) => p.seconds > 10 && p.seconds < p.duration * 0.92)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

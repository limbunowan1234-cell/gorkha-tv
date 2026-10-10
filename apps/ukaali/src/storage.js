import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Saved reels live on the phone (no sign-in needed). A tiny module-level
// cache + listeners keeps every screen's heart/Saved tab in sync.
const KEY = 'ukaali_saved_v1';
let saved = null; // array of reel objects, newest first
const listeners = new Set();

async function load() {
  if (saved) return saved;
  try {
    saved = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
  } catch {
    saved = [];
  }
  return saved;
}

function emit() {
  listeners.forEach((fn) => fn(saved));
}

export async function toggleSaved(item) {
  const list = await load();
  const exists = list.some((r) => r.youtube_video_id === item.youtube_video_id);
  saved = exists
    ? list.filter((r) => r.youtube_video_id !== item.youtube_video_id)
    : [{ ...item, savedAt: Date.now() }, ...list];
  AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
  emit();
  return !exists;
}

export function useSaved() {
  const [list, setList] = useState(saved || []);
  useEffect(() => {
    let alive = true;
    load().then((l) => alive && setList(l));
    listeners.add(setList);
    return () => {
      alive = false;
      listeners.delete(setList);
    };
  }, []);
  return list;
}

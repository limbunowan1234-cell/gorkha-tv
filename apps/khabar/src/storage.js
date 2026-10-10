import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Saved stories ("read later"), kept on the phone. No sign-in.
const KEY = 'khabar_saved_v1';
let saved = null;
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

export async function toggleSaved(story) {
  const cur = await load();
  const has = cur.some((s) => s.youtube_video_id === story.youtube_video_id);
  saved = has ? cur.filter((s) => s.youtube_video_id !== story.youtube_video_id) : [{ ...story, savedAt: Date.now() }, ...cur].slice(0, 300);
  AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
  listeners.forEach((fn) => fn(saved));
  return !has;
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

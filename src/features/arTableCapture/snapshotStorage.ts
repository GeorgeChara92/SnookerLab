import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ARTableSnapshot } from "./types";

const KEY = "ar_table_snapshots";

export const saveARTableSnapshot = async (snapshot: ARTableSnapshot) => {
  const raw = await AsyncStorage.getItem(KEY);
  const list = raw ? ((JSON.parse(raw) as ARTableSnapshot[]) || []) : [];
  const next = [snapshot, ...list].slice(0, 50);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
};

export const getLatestARTableSnapshot = async () => {
  const raw = await AsyncStorage.getItem(KEY);
  const list = raw ? ((JSON.parse(raw) as ARTableSnapshot[]) || []) : [];
  return list[0] ?? null;
};

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TableSnapshot } from "./ballTypes";

const STORAGE_KEY = "table_position_snapshots";

const parseSnapshots = (raw: string | null): TableSnapshot[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TableSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getTableSnapshots = async (): Promise<TableSnapshot[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return parseSnapshots(raw);
};

export const saveTableSnapshot = async (snapshot: TableSnapshot): Promise<void> => {
  const existing = await getTableSnapshots();
  const next = [snapshot, ...existing].slice(0, 50);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const getLatestTableSnapshot = async (): Promise<TableSnapshot | null> => {
  const all = await getTableSnapshots();
  return all[0] ?? null;
};

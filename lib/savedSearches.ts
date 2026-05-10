import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FilterValues } from "../components/FilterPanel";

const STORAGE_KEY = "propscore_saved_searches_v1";

export type AlertFreq = "never" | "weekly" | "daily" | "instant";

export interface SavedSearch {
  id: string;
  name: string;
  alertFreq: AlertFreq;
  createdAt: number;
  // Full filter snapshot
  filters: FilterValues;
  saleTypeFilter: string | null;
  gradeFilter: string | null;
  sortBy: "score" | "price" | "dom";
  sortDir: "desc" | "asc";
}

export async function loadSavedSearches(): Promise<SavedSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function persistSavedSearches(searches: SavedSearch[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
}

// Human-readable summary of a saved search's filters
export function summarizeSearch(s: SavedSearch): string {
  const parts: string[] = [];
  const f = s.filters;
  if (f.priceMin > 0 || f.priceMax < 2_000_000) {
    const lo = f.priceMin >= 1_000_000 ? `$${(f.priceMin / 1_000_000).toFixed(1)}M` : f.priceMin >= 1_000 ? `$${Math.round(f.priceMin / 1_000)}k` : `$${f.priceMin}`;
    const hi = f.priceMax >= 2_000_000 ? "$2M+" : f.priceMax >= 1_000_000 ? `$${(f.priceMax / 1_000_000).toFixed(1)}M` : `$${Math.round(f.priceMax / 1_000)}k`;
    parts.push(`${lo}–${hi}`);
  }
  if (f.scoreMin > 0 || f.scoreMax < 100) parts.push(`Score ${f.scoreMin}–${f.scoreMax}`);
  if (f.bedsMin > 0) parts.push(`${f.bedsMin}+ beds`);
  if (f.bathsMin > 0) parts.push(`${f.bathsMin}+ baths`);
  if (s.gradeFilter) parts.push(`${s.gradeFilter.charAt(0).toUpperCase() + s.gradeFilter.slice(1)} distress`);
  if (s.saleTypeFilter) parts.push(s.saleTypeFilter);
  if (f.showDistressedOnly) parts.push("Distressed only");
  if (f.showSavedOnly) parts.push("Saved only");
  if (f.showEnrichedOnly) parts.push("Enriched only");
  return parts.length ? parts.join(" · ") : "All listings";
}

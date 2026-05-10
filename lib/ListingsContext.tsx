import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchListings, MOCK_MARKET } from "./data";
import { computeMarketStats } from "./marketStats";

// ── Global signal weights ────────────────────────────────────────────────────

export const SIGNAL_KEYS = ["dom", "priceReductions", "priceVsComps", "inventory", "sellerMotivation"] as const;
export type SignalKey = typeof SIGNAL_KEYS[number];

export const SIGNAL_MAXES: Record<SignalKey, number> = {
  dom: 25, priceReductions: 20, priceVsComps: 20, inventory: 15, sellerMotivation: 15,
};

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  dom: "Days on market",
  priceReductions: "Price reductions",
  priceVsComps: "Price vs comps",
  inventory: "Inventory",
  sellerMotivation: "Seller motivation",
};

export const DEFAULT_GLOBAL_WEIGHTS: Record<SignalKey, number> = {
  dom: 1, priceReductions: 1, priceVsComps: 1, inventory: 1, sellerMotivation: 1,
};

export const WEIGHT_STEPS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function rescoreWithWeights(listing: any, weights: Record<SignalKey, number>) {
  const signals = listing.signals || {};
  const raw = SIGNAL_KEYS.reduce((sum, k) => sum + (signals[k] || 0) * weights[k], 0);
  const maxPossible = SIGNAL_KEYS.reduce((sum, k) => sum + SIGNAL_MAXES[k] * weights[k], 0);
  const score = maxPossible > 0 ? Math.round((raw / maxPossible) * 100) : listing.score;
  const grade = score >= 55 ? "high" : score >= 30 ? "medium" : "low";
  return { ...listing, score, grade };
}

// ── Context type ─────────────────────────────────────────────────────────────

interface ListingsContextType {
  listings: any[];           // re-scored with global weights
  rawListings: any[];        // original PropScore (DEFAULT_WEIGHTS)
  loading: boolean;
  fetchError: string | null;
  savedHomes: Set<string>;
  toggleSaved: (id: string) => void;
  updateListing: (id: string, fields: Partial<any>) => void;
  marketStats: any[];
  avgCutPct: number;
  avgDOM: number | null;
  // Global weights
  weights: Record<SignalKey, number>;
  setWeights: React.Dispatch<React.SetStateAction<Record<SignalKey, number>>>;
  resetWeights: () => void;
  hasCustomWeights: boolean;
}

const ListingsContext = createContext<ListingsContextType>({
  listings: [],
  rawListings: [],
  loading: true,
  fetchError: null,
  savedHomes: new Set(),
  toggleSaved: () => {},
  updateListing: () => {},
  marketStats: [],
  avgCutPct: 0,
  avgDOM: null,
  weights: DEFAULT_GLOBAL_WEIGHTS,
  setWeights: () => {},
  resetWeights: () => {},
  hasCustomWeights: false,
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const [rawListings, setRawListings] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [savedHomes, setSavedHomes]   = useState<Set<string>>(new Set());
  const [weights, setWeights]         = useState<Record<SignalKey, number>>(DEFAULT_GLOBAL_WEIGHTS);

  useEffect(() => {
    fetchListings()
      .then(data => { setRawListings(data); setFetchError(null); })
      .catch(err => {
        console.error("fetchListings failed:", err);
        setFetchError(err?.message || "Network error — check connection");
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setSavedHomes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const updateListing = useCallback((id: string, fields: Partial<any>) => {
    setRawListings(prev => prev.map(l => String(l.id) === id ? { ...l, ...fields } : l));
  }, []);

  const resetWeights = useCallback(() => setWeights(DEFAULT_GLOBAL_WEIGHTS), []);

  const hasCustomWeights = useMemo(
    () => SIGNAL_KEYS.some(k => weights[k] !== DEFAULT_GLOBAL_WEIGHTS[k]),
    [weights],
  );

  // Re-score all listings when weights change
  const listings = useMemo(
    () => rawListings.map(l => rescoreWithWeights(l, weights)),
    [rawListings, weights],
  );

  const marketStats = computeMarketStats(listings, MOCK_MARKET.monthsSupply);

  const allWithCuts = listings.filter(p => p.pricecuts > 0);
  const avgCutPct = allWithCuts.length
    ? Math.round(allWithCuts.reduce((s, p) => {
        const orig = p.priceHistory?.[0]?.price || p.price;
        return s + (orig > 0 ? ((orig - p.price) / orig * 100) : 0);
      }, 0) / allWithCuts.length * 10) / 10
    : 0;

  const allWithDOM = listings.filter(p => p.dom > 0);
  const avgDOM = allWithDOM.length
    ? Math.round(allWithDOM.reduce((s, p) => s + p.dom, 0) / allWithDOM.length)
    : null;

  return (
    <ListingsContext.Provider value={{
      listings, rawListings, loading, fetchError,
      savedHomes, toggleSaved, updateListing,
      marketStats, avgCutPct, avgDOM,
      weights, setWeights, resetWeights, hasCustomWeights,
    }}>
      {children}
    </ListingsContext.Provider>
  );
}

export function useListings() {
  return useContext(ListingsContext);
}

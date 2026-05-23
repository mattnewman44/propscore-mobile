import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchListings, fetchNews, MOCK_MARKET, API_BASE } from "./data";
import { scoreProperty, DEFAULT_WEIGHTS } from "./scoring";
import { computeMarketStats } from "./marketStats";

// ── Signal keys (6 total, matches web app) ────────────────────────────────────

export const SIGNAL_KEYS = ["dom", "priceReductions", "priceVsComps", "inventory", "sellerMotivation", "localNews"] as const;
export type SignalKey = typeof SIGNAL_KEYS[number];

export const SIGNAL_MAXES: Record<SignalKey, number> = {
  dom: 25, priceReductions: 20, priceVsComps: 20, inventory: 15, sellerMotivation: 15, localNews: 5,
};

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  dom: "Days on market",
  priceReductions: "Price reductions",
  priceVsComps: "Price vs comps",
  inventory: "Inventory",
  sellerMotivation: "Seller motivation",
  localNews: "Local news",
};

export const DEFAULT_GLOBAL_WEIGHTS: Record<SignalKey, number> = {
  dom: 1, priceReductions: 1, priceVsComps: 1, inventory: 1, sellerMotivation: 1, localNews: 1,
};

export const WEIGHT_STEPS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function scoreRow(row: any, market: any, news: any[]) {
  const scored = scoreProperty(row, market, news, DEFAULT_WEIGHTS);
  const grade = scored.score >= 70 ? "high" : scored.score >= 40 ? "medium" : "low";
  return { ...scored, grade };
}

function rescoreWithWeights(listing: any, weights: Record<SignalKey, number>) {
  const signals = listing.signals || {};
  const raw = SIGNAL_KEYS.reduce((sum, k) => sum + (signals[k] || 0) * weights[k], 0);
  const maxPossible = SIGNAL_KEYS.reduce((sum, k) => sum + SIGNAL_MAXES[k] * weights[k], 0);
  const score = maxPossible > 0 ? Math.round((raw / maxPossible) * 100) : listing.score;
  const grade = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return { ...listing, score, grade };
}

// ── Rental stats from market API ──────────────────────────────────────────────

function computeRentalStats(marketData: any) {
  if (!marketData) return [];
  const fmtMoney = (n: number | null | undefined) =>
    n != null ? (n >= 1000 ? `$${Math.round(n / 100) / 10}k` : `$${n}`) : "—";

  const zori = marketData.zori || null;
  const zhvi = marketData.zhvi || null;
  const RATE = 0.068; // 30yr fixed ~6.8%

  // Computed locally — API does not return these directly
  const grossYield = zori && zhvi ? Math.round((zori * 12 / zhvi) * 1000) / 10 : null;
  const rtm        = zori && zhvi ? Math.round((zori / (zhvi * RATE / 12)) * 100) / 100 : null;

  return [
    {
      abbr: "RN", label: "Avg Monthly Rent", type: "rent",
      raw: zori,
      display: fmtMoney(zori),
      barMax: 4000,
      note: zori ? "ZORI (Zillow Observed Rent Index)" : "—",
    },
    {
      abbr: "RG", label: "Rent Growth YoY", type: "rentgrowth",
      raw: marketData.zoriGrowth != null ? marketData.zoriGrowth : null,
      display: marketData.zoriGrowth != null ? `${marketData.zoriGrowth > 0 ? "+" : ""}${marketData.zoriGrowth.toFixed(1)}%` : "—",
      barMax: 10,
      note: marketData.zoriGrowth != null ? (marketData.zoriGrowth > 0 ? "Rents rising" : "Rents softening") : "—",
    },
    {
      abbr: "GY", label: "Est. Gross Yield", type: "yield",
      raw: grossYield,
      display: grossYield != null ? `${grossYield}%` : "—",
      barMax: 12,
      note: grossYield != null ? (grossYield >= 6 ? "Strong yield" : grossYield >= 4 ? "Moderate yield" : "Low yield") : "—",
    },
    {
      abbr: "RM", label: "Rent-to-Mortgage", type: "rtm",
      raw: rtm,
      display: rtm != null ? `${rtm.toFixed(2)}×` : "—",
      barMax: 1.5,
      note: rtm != null ? (rtm >= 1.0 ? "Rent covers mortgage" : "Rent below mortgage") : "—",
    },
  ].filter(s => s.raw != null);
}

// ── Context type ──────────────────────────────────────────────────────────────

interface ListingsContextType {
  listings: any[];
  rawListings: any[];
  loading: boolean;
  fetchError: string | null;
  savedHomes: Set<string>;
  toggleSaved: (id: string) => void;
  updateListing: (id: string, fields: Partial<any>) => void;
  marketStats: any[];
  rentalStats: any[];
  marketData: any | null;
  avgCutPct: number;
  avgDOM: number | null;
  news: any[];
  weights: Record<SignalKey, number>;
  setWeights: React.Dispatch<React.SetStateAction<Record<SignalKey, number>>>;
  resetWeights: () => void;
  hasCustomWeights: boolean;
}

const ListingsContext = createContext<ListingsContextType>({
  listings: [], rawListings: [], loading: true, fetchError: null,
  savedHomes: new Set(), toggleSaved: () => {}, updateListing: () => {},
  marketStats: [], rentalStats: [], marketData: null, avgCutPct: 0, avgDOM: null,
  news: [], weights: DEFAULT_GLOBAL_WEIGHTS, setWeights: () => {}, resetWeights: () => {},
  hasCustomWeights: false,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const [rawData, setRawData]         = useState<any[]>([]); // unscored mapped rows
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [savedHomes, setSavedHomes]   = useState<Set<string>>(new Set());
  const [weights, setWeights]         = useState<Record<SignalKey, number>>(DEFAULT_GLOBAL_WEIGHTS);
  const [marketData, setMarketData]   = useState<any | null>(null);
  const [news, setNews]               = useState<any[]>([]);

  useEffect(() => {
    fetchListings()
      .then(data => {
        setRawData(data);
        setFetchError(null);
        const first = data.find((l: any) => l.zip && l.lat && l.lng);
        if (first) {
          // Fetch market data
          fetch(`${API_BASE}/api/market?zip=${first.zip}`)
            .then(r => r.ok ? r.json() : null)
            .then(md => { if (md) setMarketData(md); })
            .catch(() => {});
          // Fetch area news for scoring
          fetchNews(first.lat, first.lng, first.city, first.state)
            .then(articles => { if (articles.length) setNews(articles); })
            .catch(() => {});
        }
      })
      .catch(err => {
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
    setRawData(prev => prev.map(l => String(l.id) === id ? { ...l, ...fields } : l));
  }, []);

  const resetWeights = useCallback(() => setWeights(DEFAULT_GLOBAL_WEIGHTS), []);

  const hasCustomWeights = useMemo(
    () => SIGNAL_KEYS.some(k => weights[k] !== DEFAULT_GLOBAL_WEIGHTS[k]),
    [weights],
  );

  const market = marketData || MOCK_MARKET;

  // Score raw data with news → rawListings (PropScore baseline)
  const rawListings = useMemo(
    () => rawData.map(row => scoreRow(row, market, news)),
    [rawData, market, news],
  );

  // Apply custom weights → listings (user-adjusted)
  const listings = useMemo(
    () => rawListings.map(l => rescoreWithWeights(l, weights)),
    [rawListings, weights],
  );

  const marketStats = computeMarketStats(listings, marketData?.monthsSupply ?? MOCK_MARKET.monthsSupply);
  const rentalStats = useMemo(() => computeRentalStats(marketData), [marketData]);

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
      marketStats, rentalStats, marketData, avgCutPct, avgDOM,
      news, weights, setWeights, resetWeights, hasCustomWeights,
    }}>
      {children}
    </ListingsContext.Provider>
  );
}

export function useListings() {
  return useContext(ListingsContext);
}

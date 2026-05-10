import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchListings, MOCK_MARKET } from "./data";
import { computeMarketStats } from "./marketStats";

interface ListingsContextType {
  listings: any[];
  loading: boolean;
  savedHomes: Set<string>;
  toggleSaved: (id: string) => void;
  updateListing: (id: string, fields: Partial<any>) => void;
  marketStats: any[];
  avgCutPct: number;
  avgDOM: number | null;
}

const ListingsContext = createContext<ListingsContextType>({
  listings: [],
  loading: true,
  savedHomes: new Set(),
  toggleSaved: () => {},
  updateListing: () => {},
  marketStats: [],
  avgCutPct: 0,
  avgDOM: null,
});

export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [savedHomes, setSavedHomes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchListings()
      .then(data => setListings(data))
      .catch(console.error)
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
    setListings(prev => prev.map(l => String(l.id) === id ? { ...l, ...fields } : l));
  }, []);

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
    <ListingsContext.Provider value={{ listings, loading, savedHomes, toggleSaved, updateListing, marketStats, avgCutPct, avgDOM }}>
      {children}
    </ListingsContext.Provider>
  );
}

export function useListings() {
  return useContext(ListingsContext);
}

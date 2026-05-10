import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { scoreProperty, DEFAULT_WEIGHTS } from "./scoring";

const SUPABASE_URL = "https://bdkawkitoixkymnoinyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJka2F3a2l0b2l4a3ltbm9pbnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTA0MDIsImV4cCI6MjA5MzQ4NjQwMn0.by3vbYc-ARhscJo3meuxRTmTN4L1ECZWOs9xbkr9q_0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

export const API_BASE = "https://distressed-property-finder-v2.vercel.app";

export const MOCK_MARKET = { monthsSupply: 8.2, medianDOM: 45, medianSalePrice: 450000, activeListings: 847, priceDropPct: 28, source: "mock" };

function mapRow(row: any) {
  const priceHistory: { date: string; price: number }[] = [];
  if (row.price_cut_date && row.price_cut_amount && row.price) {
    priceHistory.push({ date: row.price_cut_date, price: row.price + (row.price_cut_amount || 0) });
  }
  priceHistory.push({ date: row.parsed_at ? row.parsed_at.slice(0, 10) : "Current", price: row.price || 0 });
  return {
    id: row.zpid || row.id,
    zpid: row.zpid,
    address: row.address || "",
    city: row.city || "",
    state: row.state || "",
    zip: row.zip || "",
    lat: row.lat,
    lng: row.lng,
    price: row.price || 0,
    bedrooms: row.beds || row.bedrooms || 0,
    bathrooms: row.baths || row.bathrooms || 0,
    sqft: row.sqft || null,
    dom: row.dom || 0,
    priceHistory,
    avgCompPrice: row.avm_estimate || row.price || 0,
    vacant: false,
    probate: false,
    failedListing: row.is_price_reduced || false,
    mlsStatus: row.listing_status || row.mls_status || "FOR_SALE",
    listingRemarks: row.listing_remarks || "",
    floodZone: row.flood_zone || null,
    source: row.listing_source || "rapidapi_realtor",
    zillowUrl: row.listing_url || row.zillow_url || null,
    is_foreclosure: row.is_foreclosure || false,
    is_price_reduced: row.is_price_reduced || false,
    last_sold_price: row.last_sold_price || null,
    last_sold_date: row.last_sold_date || null,
    avm_estimate: row.avm_estimate || null,
    photo_url: row.photo_url || null,
    enriched: row.enriched || false,
  };
}

export async function fetchListings() {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("listing_source", "rapidapi_realtor")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all.map(mapRow).map(p => scoreProperty(p, MOCK_MARKET, [], DEFAULT_WEIGHTS));
}

export async function searchByAddress(address: string) {
  const res = await fetch(`${API_BASE}/api/property-search?address=${encodeURIComponent(address)}`);
  const json = await res.json();
  if (json.error || !json.detail) return null;

  const detail = json.detail;
  const search = json.search || {};
  const price = detail.list_price || search.list_price || 0;
  const loc = detail.location?.address || {};
  const desc = detail.description || {};

  const isPriceReduced = !!(detail.flags?.is_price_reduced || search.flags?.is_price_reduced);
  const priceHistory = [{ date: "Current", price }];
  const history = detail.price_history || detail.listing_history || [];
  if (history.length > 0) {
    const prices = history.map((h: any) => h.price || h.list_price).filter((p: number) => p && p > price && p <= price * 1.4);
    if (prices.length > 0) priceHistory.unshift({ date: "List price", price: Math.min(...prices) });
  } else if (isPriceReduced) {
    const orig = detail.list_price_max || detail.original_list_price;
    if (orig && orig > price && orig <= price * 1.4) priceHistory.unshift({ date: "List price", price: orig });
  }

  const raw = {
    id: detail.property_id || address,
    address: loc.line || address,
    city: loc.city || "",
    state: loc.state_code || "",
    zip: loc.postal_code || "",
    lat: detail.location?.address?.lat || null,
    lng: detail.location?.address?.lon || null,
    price,
    bedrooms: desc.beds || 0,
    bathrooms: desc.baths || 0,
    sqft: desc.sqft || null,
    dom: detail.list_date ? Math.floor((Date.now() - new Date(detail.list_date).getTime()) / 86400000) : 0,
    priceHistory,
    avgCompPrice: detail.estimates?.current_values?.find((v: any) => v.isbest_homevalue)?.estimate || 0,
    listingRemarks: desc.text || "",
    is_foreclosure: !!(detail.flags?.is_foreclosure || search.flags?.is_foreclosure),
    is_price_reduced: isPriceReduced,
    vacant: false, probate: false, failedListing: isPriceReduced,
    photo_url: detail.primary_photo?.href || null,
    enriched: true, source: "api",
  };

  return scoreProperty(raw, MOCK_MARKET, [], DEFAULT_WEIGHTS);
}

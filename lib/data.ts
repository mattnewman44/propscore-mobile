import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bdkawkitoixkymnoinyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJka2F3a2l0b2l4a3ltbm9pbnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTA0MDIsImV4cCI6MjA5MzQ4NjQwMn0.by3vbYc-ARhscJo3meuxRTmTN4L1ECZWOs9xbkr9q_0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export const API_BASE = "https://distressed-property-finder-v2.vercel.app";

export const MOCK_MARKET = { monthsSupply: 8.2, medianDOM: 45, medianSalePrice: 450000, activeListings: 847, priceDropPct: 28, source: "mock" };

export interface Bounds {
  latMin: number; latMax: number; lngMin: number; lngMax: number;
}

// ── Listing-cycle helpers ─────────────────────────────────────────────────────

/** Parse price-drop summary from the raw API property_history array (newest-first). */
function parseListingCycle(propertyHistory: any[]): {
  startPrice: number | null; startDate: string | null;
  dropCount: number; lastDropDate: string | null; lastDropAmount: number;
} {
  if (!propertyHistory?.length) return { startPrice: null, startDate: null, dropCount: 0, lastDropDate: null, lastDropAmount: 0 };
  const isForSaleListing = (ev: string, price: number | null) => {
    const low = (ev || "").toLowerCase();
    return (price ?? 0) > 0 &&
      (low === "listed" || low === "relisted" ||
       (low.includes("listed") && !low.includes("rent") && !low.includes("removed")));
  };
  const listedIdx = propertyHistory.findIndex(h => isForSaleListing(h.event_name, h.price));
  if (listedIdx === -1) return { startPrice: null, startDate: null, dropCount: 0, lastDropDate: null, lastDropAmount: 0 };
  const listed = propertyHistory[listedIdx];
  const sinceListed = propertyHistory.slice(0, listedIdx);
  const changes = sinceListed.filter(h => (h.event_name || "").toLowerCase().includes("price changed") && (h.price ?? 0) > 0);
  let dropCount = 0, lastDropDate: string | null = null, lastDropAmount = 0;
  for (let i = 0; i < changes.length; i++) {
    const prevPrice = i + 1 < changes.length ? changes[i + 1].price : listed.price;
    if ((changes[i].price ?? 0) < (prevPrice ?? 0)) {
      dropCount++;
      if (dropCount === 1) { lastDropDate = changes[i].date; lastDropAmount = (prevPrice ?? 0) - (changes[i].price ?? 0); }
    }
  }
  return { startPrice: listed.price, startDate: listed.date, dropCount, lastDropDate, lastDropAmount };
}

/** Extract normalised AVM estimates object from detail.estimates. */
function parseAvmEstimates(estimates: any): any | null {
  if (!estimates) return null;
  return {
    current: (estimates.current_values || []).map((v: any) => ({
      source: v.source?.name, type: v.source?.type, estimate: v.estimate, isBest: v.isbest_homevalue,
    })),
    historical: (estimates.historical_values || []).map((h: any) => ({
      source: h.source?.name, type: h.source?.type,
      estimates: (h.estimates || []).slice(0, 24), // keep 24 months
    })),
    forecast: (estimates.forecast_values || []).map((f: any) => ({
      source: f.source?.name, type: f.source?.type, estimates: f.estimates || [],
    })),
  };
}

function mapRow(row: any) {
  let priceHistory: { date: string; price: number; event?: string }[];
  if (row.price_history && Array.isArray(row.price_history) && row.price_history.length > 0) {
    priceHistory = row.price_history.filter((h: any) => h.price > 0);
    const lastPrice = priceHistory[priceHistory.length - 1]?.price;
    if (!priceHistory.length || lastPrice !== (row.price || 0))
      priceHistory.push({ date: row.parsed_at ? row.parsed_at.slice(0, 10) : "Current", price: row.price || 0 });
  } else {
    priceHistory = [];
    if (row.price_cut_date && row.price_cut_amount && row.price)
      priceHistory.push({ date: row.price_cut_date, price: row.price + (row.price_cut_amount || 0) });
    priceHistory.push({ date: row.parsed_at ? row.parsed_at.slice(0, 10) : "Current", price: row.price || 0 });
  }
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
    avgCompPrice: row.avg_comp_price || row.avm_estimate || row.price || 0,
    propType: row.prop_type || null,
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
    // Listing-cycle fields (populated after enrich)
    listingStartPrice: row.listing_start_price || null,
    listingStartDate:  row.listing_start_date  || null,
    priceDropCount:    row.price_drop_count     ?? null,
    lastDropDate:      row.last_drop_date       || null,
    lastDropAmount:    row.last_drop_amount      || 0,
    avmEstimates:      row.avm_estimates        || null,
  };
}

// Returns unscored mapped rows — context handles scoring with news + weights
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
  return all.map(mapRow);
}

export async function fetchSoldComps(bounds: Bounds) {
  const minSold = new Date();
  minSold.setMonth(minSold.getMonth() - 24);
  const minSoldIso = minSold.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("sold_comps")
    .select("id, address, city, state, lat, lng, sold_price, sold_date, bedrooms, bathrooms, sqft, prop_type")
    .not("lat", "is", null).not("lng", "is", null)
    .gte("lat", bounds.latMin).lte("lat", bounds.latMax)
    .gte("lng", bounds.lngMin).lte("lng", bounds.lngMax)
    .gte("sold_date", minSoldIso)
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchOffMarketListings(bounds: Bounds) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, address, city, state, lat, lng, price, bedrooms, bathrooms, sqft, listing_status")
    .eq("listing_status", "OFF_MARKET")
    .not("lat", "is", null).not("lng", "is", null)
    .gte("lat", bounds.latMin).lte("lat", bounds.latMax)
    .gte("lng", bounds.lngMin).lte("lng", bounds.lngMax)
    .limit(300);
  if (error) throw error;
  return data || [];
}

export async function fetchNews(lat: number, lng: number, city?: string, state?: string) {
  try {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (city) params.set("city", city);
    if (state) params.set("state", state);
    const res = await fetch(`${API_BASE}/api/news?${params}`);
    const json = await res.json();
    return json.articles || [];
  } catch {
    return [];
  }
}

function mapApiDetail(detail: any, search: any, address: string, autoCompPrice?: number | null) {
  const price = detail.list_price || search.list_price || 0;
  const loc   = detail.location?.address || {};
  const desc  = detail.description || {};
  const isPriceReduced = !!(detail.flags?.is_price_reduced || search.flags?.is_price_reduced);

  const rawStatus = (detail.status || search.status || "").toLowerCase();
  const ACTIVE_STATUSES = ["for_sale", "active", "for sale", "new_listing", "new listing", "price_reduced"];
  const isActive = ACTIVE_STATUSES.some(s => rawStatus.includes(s)) || rawStatus === "";
  const listDaysAgo = detail.list_date
    ? Math.floor((Date.now() - new Date(detail.list_date).getTime()) / 86400000)
    : 0;
  const isOffMarket = !isActive || (!rawStatus && listDaysAgo > 365);

  // Build full price history from property_history (all events, oldest-first)
  let priceHistory: { date: string; price: number; event?: string }[];
  const rawHistory = detail.property_history || detail.price_history || detail.listing_history || [];
  if (rawHistory.length > 0) {
    const hist = rawHistory
      .filter((h: any) => (h.price || h.list_price) > 0)
      .map((h: any) => ({ date: h.date || "Unknown", price: h.price || h.list_price, event: h.event_name || undefined }))
      .reverse(); // Realtor.com returns newest-first; reverse to oldest-first
    if (!hist.length || hist[hist.length - 1].price !== price) hist.push({ date: "Current", price });
    priceHistory = hist;
  } else if (isPriceReduced) {
    const orig = detail.list_price_max || detail.original_list_price;
    priceHistory = orig && orig > price
      ? [{ date: "List price", price: orig }, { date: "Current", price }]
      : [{ date: "Current", price }];
  } else {
    priceHistory = [{ date: "Current", price }];
  }

  // Listing-cycle summary from raw property_history (newest-first = same order API returns)
  const cycle = parseListingCycle(rawHistory);
  // AVM from all three sources
  const avmEstimates = parseAvmEstimates(detail.estimates);
  const bestAvm = detail.estimates?.current_values?.find((v: any) => v.isbest_homevalue)?.estimate || null;

  return {
    id: detail.property_id || address,
    address: loc.line || address,
    city: loc.city || "", state: loc.state_code || "", zip: loc.postal_code || "",
    lat: loc.coordinate?.lat || null, lng: loc.coordinate?.lon || null,
    price, bedrooms: desc.beds || 0, bathrooms: desc.baths || 0, sqft: desc.sqft || null,
    dom: isOffMarket ? 0 : listDaysAgo,
    _offMarket: isOffMarket,
    mlsStatus: isOffMarket ? "OFF_MARKET" : (detail.status || "FOR_SALE"),
    priceHistory,
    propType: desc.type || null,
    avgCompPrice: autoCompPrice ?? bestAvm ?? 0,
    listingRemarks: desc.text || "",
    floodZone: detail.local?.flood?.fema_zone?.[0] || null,
    avm_estimate: bestAvm,
    avmEstimates,
    last_sold_price: detail.last_sold_price || null, last_sold_date: detail.last_sold_date || null,
    photo_url:    detail.photos?.[0]?.href?.replace(/s\.jpg$/, "od-w1024_h768.jpg") || null,
    brokerage:    detail.branding?.[1]?.name || detail.branding?.[0]?.name || null,
    agentName:    detail.agents?.[0]?.full_name || detail.branding?.[0]?.name || null,
    agentPhone:   detail.agents?.[0]?.phones?.[0]?.number || null,
    agentHref:    detail.agents?.[0]?.href || null,
    is_foreclosure: !!(detail.flags?.is_foreclosure || search.flags?.is_foreclosure),
    is_price_reduced: isPriceReduced,
    vacant: false, probate: false, failedListing: isPriceReduced,
    enriched: true, source: "api", _searchSource: "api",
    listingStartPrice: cycle.startPrice,
    listingStartDate:  cycle.startDate,
    priceDropCount:    cycle.dropCount,
    lastDropDate:      cycle.lastDropDate,
    lastDropAmount:    cycle.lastDropAmount,
  };
}

async function upsertListing(p: any): Promise<void> {
  try {
    await supabase.from("listings").upsert({
      zpid:              p.zpid || p.id || null,
      address:           p.address,
      city:              p.city,
      state:             p.state,
      zip:               p.zip,
      lat:               p.lat,
      lng:               p.lng,
      price:             p.price,
      beds:              p.bedrooms,
      baths:             p.bathrooms,
      sqft:              p.sqft || null,
      listing_remarks:   p.listingRemarks || null,
      flood_zone:        p.floodZone || null,
      avm_estimate:      p.avm_estimate || null,
      avg_comp_price:    p.avgCompPrice || null,
      last_sold_price:   p.last_sold_price || null,
      last_sold_date:    p.last_sold_date || null,
      photo_url:         p.photo_url || null,
      is_foreclosure:    p.is_foreclosure || false,
      is_price_reduced:  p.is_price_reduced || false,
      price_history:     p.priceHistory?.length > 1 ? p.priceHistory : null,
      prop_type:         p.propType || null,
      avm_estimates:     p.avmEstimates || null,
      listing_start_price: p.listingStartPrice || null,
      listing_start_date:  p.listingStartDate  || null,
      price_drop_count:    p.priceDropCount    ?? null,
      last_drop_date:      p.lastDropDate      || null,
      last_drop_amount:    p.lastDropAmount    || null,
      listing_source:    "realtor_search",
      enriched:          true,
      enriched_at:       new Date().toISOString(),
      dom:               p.dom || null,
      listing_status:    p._offMarket ? "OFF_MARKET" : "FOR_SALE",
      parsed_at:         new Date().toISOString(),
    }, { onConflict: "zpid" });
  } catch {
    // non-blocking
  }
}

export async function searchByAddress(address: string, lat?: number, lng?: number) {
  // Step 1: coord match if lat/lng provided (fast, handles off-market + on-market)
  if (lat != null && lng != null) {
    const searchedNum    = parseInt(address.match(/^\d+/)?.[0] ?? "") || null;
    const searchedStreet = address.split(",")[0].replace(/^\d+\s*/, "").toLowerCase().trim();
    const { data: coordData } = await supabase
      .from("listings")
      .select("*")
      .gte("lat", lat - 0.002).lte("lat", lat + 0.002)
      .gte("lng", lng - 0.002).lte("lng", lng + 0.002);
    if (coordData && coordData.length > 0) {
      const closest = coordData.reduce((best: any, row: any) => {
        const d = (row.lat - lat) ** 2 + (row.lng - lng) ** 2;
        const bd = (best.lat - lat) ** 2 + (best.lng - lng) ** 2;
        return d < bd ? row : best;
      });
      const closestNum    = parseInt(closest.address?.match(/^\d+/)?.[0] ?? "") || null;
      const closestStreet = (closest.address || "").replace(/^\d+\s*/, "").toLowerCase().trim();
      const numMatch = !searchedNum || !closestNum || Math.abs(searchedNum - closestNum) <= 10;
      const s1 = searchedStreet.split(/\s+/)[0] || "";
      const s2 = closestStreet.split(/\s+/)[0] || "";
      const streetMatch = !s1 || !s2 || s1 === s2 || closestStreet.includes(s1) || searchedStreet.includes(s2);
      if (numMatch && streetMatch) {
        return { ...mapRow(closest), _searchSource: "database", _refreshing: true };
      }
    }
  }

  // Step 2: address string match
  const streetPart = address.split(",")[0].trim();
  if (streetPart.length >= 4) {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .ilike("address", `%${streetPart}%`)
      .limit(5);
    if (data && data.length > 0) {
      const best = lat != null && data.length > 1
        ? data.reduce((b: any, row: any) => {
            const d = (row.lat - lat!) ** 2 + (row.lng - lng!) ** 2;
            const bd = (b.lat - lat!) ** 2 + (b.lng - lng!) ** 2;
            return d < bd ? row : b;
          })
        : data[0];
      return { ...mapRow(best), _searchSource: "database", _refreshing: true };
    }
  }

  // Step 3: Realtor.com API fallback
  const params = new URLSearchParams({ address });
  if (lat != null && lng != null) { params.set("lat", String(lat)); params.set("lng", String(lng)); }
  const res  = await fetch(`${API_BASE}/api/property-search?${params}`);
  const json = await res.json();
  if (json.error || !json.detail) return null;
  const raw = mapApiDetail(json.detail, json.search || {}, address, json.avgCompPrice);
  upsertListing(raw); // fire-and-forget
  return raw;
}

// Background enrichment — call after showing a cached Supabase result
export async function enrichByAddress(prop: any): Promise<Partial<any> | null> {
  try {
    const lat = prop.lat;
    const lng = prop.lng;
    const addr = [prop.address, prop.city, prop.state].filter(Boolean).join(", ");
    const coordParams = lat != null && lng != null ? `lat=${lat}&lng=${lng}&` : "";
    const sqftParam   = prop.sqft ? `&sqft=${prop.sqft}` : "";
    const addrParam   = `address=${encodeURIComponent(addr)}`;
    const res  = await fetch(`${API_BASE}/api/property-search?${coordParams}${addrParam}${sqftParam}`);
    const json = await res.json();
    if (!json.detail) return null;
    const d = json.detail;
    const enrichedFields = {
      sqft:            d.description?.sqft                                                   ?? prop.sqft,
      listingRemarks:  d.description?.text                                                   ?? prop.listingRemarks,
      floodZone:       d.local?.flood?.fema_zone?.[0]                                        ?? prop.floodZone,
      avgCompPrice:    json.avgCompPrice                                                     ?? prop.avgCompPrice,
      avm_estimate:    d.estimates?.current_values?.find((v: any) => v.isbest_homevalue)?.estimate ?? prop.avm_estimate,
      last_sold_price: d.last_sold_price                                                     ?? prop.last_sold_price,
      last_sold_date:  d.last_sold_date                                                      ?? prop.last_sold_date,
      photo_url:       d.photos?.[0]?.href?.replace(/s\.jpg$/, "od-w1024_h768.jpg")         ?? prop.photo_url,
      brokerage:       (d.branding?.[1]?.name || d.branding?.[0]?.name)                     ?? prop.brokerage,
      agentName:       (d.agents?.[0]?.full_name || d.branding?.[0]?.name)                  ?? prop.agentName,
      agentPhone:      d.agents?.[0]?.phones?.[0]?.number                                   ?? prop.agentPhone,
      agentHref:       d.agents?.[0]?.href                                                   ?? prop.agentHref,
      price:           d.list_price                                                          || prop.price,
      propType:        d.description?.type                                                   ?? prop.propType,
      priceHistory:    (() => {
        const rawH = d.property_history || d.price_history || [];
        if (rawH.length > 0) {
          const hist = rawH.filter((h: any) => (h.price||h.list_price) > 0)
            .map((h: any) => ({ date: h.date || "Unknown", price: h.price || h.list_price, event: h.event_name || undefined }))
            .reverse();
          const cur = d.list_price || prop.price || 0;
          if (!hist.length || hist[hist.length-1].price !== cur) hist.push({ date: "Current", price: cur });
          return hist;
        }
        return prop.priceHistory;
      })(),
      avmEstimates:    parseAvmEstimates(d.estimates) ?? prop.avmEstimates,
      ...(() => {
        const rawH = d.property_history || d.price_history || [];
        const cycle = parseListingCycle(rawH);
        return rawH.length > 0 ? {
          listingStartPrice: cycle.startPrice,
          listingStartDate:  cycle.startDate,
          priceDropCount:    cycle.dropCount,
          lastDropDate:      cycle.lastDropDate,
          lastDropAmount:    cycle.lastDropAmount,
        } : {};
      })(),
      enriched:        true,
      _refreshedAt:    Date.now(),
      _refreshing:     false,
    };
    upsertListing({ ...prop, ...enrichedFields });
    return enrichedFields;
  } catch {
    return null;
  }
}

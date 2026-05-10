export function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const DEFAULT_WEIGHTS = { dom:1, priceReductions:1, priceVsComps:1, inventory:1, sellerMotivation:1, localNews:1 };

export const FINANCING_KEYWORDS = {
  cashOnly:    { patterns:[/cash only/i,/cash-only/i,/no financing/i,/proof of funds/i], label:"Cash only", color:"#7c3aed", bg:"#f5f3ff" },
  asIs:        { patterns:[/as.is/i,/sold as.is/i,/no repairs/i,/seller will not/i,/handyman/i], label:"As-is", color:"#b45309", bg:"#fffbeb" },
  noFhaVa:     { patterns:[/no fha/i,/no va/i,/conventional only/i], label:"No FHA/VA", color:"#0369a1", bg:"#f0f9ff" },
  floodDamage: { patterns:[/flood damage/i,/water damage/i,/storm damage/i,/hurricane damage/i], label:"Flood/storm damage", color:"#b91c1c", bg:"#fef2f2" },
  mold:        { patterns:[/mold/i,/remediation/i], label:"Mold", color:"#9a3412", bg:"#fff7ed" },
  reo:         { patterns:[/bank.owned/i,/reo/i,/hud/i,/foreclosure/i], label:"Bank-owned/REO", color:"#374151", bg:"#f9fafb" },
  shortSale:   { patterns:[/short sale/i,/potential short sale/i], label:"Short sale", color:"#dc2626", bg:"#fef2f2" },
  probate:     { patterns:[/probate/i,/estate sale/i,/subject to probate/i], label:"Probate/estate", color:"#6b21a8", bg:"#fdf4ff" },
  fixer:       { patterns:[/fixer/i,/tLC/i,/needs work/i,/renovation/i,/203k/i], label:"Fixer-upper", color:"#065f46", bg:"#ecfdf5" },
};

export function parseFinancingFlags(remarks) {
  if (!remarks) return [];
  return Object.entries(FINANCING_KEYWORDS)
    .filter(([, { patterns }]) => patterns.some(p => p.test(remarks)))
    .map(([key, { label, color, bg }]) => ({ key, label, color, bg }));
}

export const OPPORTUNITY_TYPES = {
  institutional:   { label:"Institutional sale", sublabel:"Bank/REO/HUD", icon:"🏦", color:"#374151", bg:"#f9fafb", border:"#d1d5db" },
  shortSale:       { label:"Short sale", sublabel:"Bank approval required", icon:"⏳", color:"#0369a1", bg:"#f0f9ff", border:"#bae6fd" },
  probateEstate:   { label:"Probate / estate sale", sublabel:"Court or executor involved", icon:"⚖️", color:"#6b21a8", bg:"#fdf4ff", border:"#e9d5ff" },
  motivatedSeller: { label:"Motivated seller", sublabel:"Human seller, high urgency", icon:"🔥", color:"#b91c1c", bg:"#fef2f2", border:"#fca5a5" },
  standard:        { label:"Standard listing", sublabel:"No distress signals", icon:"🏠", color:"#15803d", bg:"#f0fdf4", border:"#86efac" },
};

export function classifyOpportunityType(prop, flags) {
  const remarks = (prop.listingRemarks || "").toLowerCase();
  const flagKeys = flags.map(f => f.key);
  if (prop.is_foreclosure || flagKeys.includes("reo") || /hud home/i.test(remarks) || /bank.owned/i.test(remarks)) return OPPORTUNITY_TYPES.institutional;
  if (flagKeys.includes("shortSale")) return OPPORTUNITY_TYPES.shortSale;
  if (flagKeys.includes("probate") || prop.probate) return OPPORTUNITY_TYPES.probateEstate;
  const isMotivated = prop.dom > 60 || prop.priceHistory?.length > 2 || prop.vacant || prop.failedListing ||
    prop.is_price_reduced || flagKeys.includes("fixer") || flagKeys.includes("asIs") ||
    /motivated seller/i.test(remarks) || /price reduced/i.test(remarks) || /must sell/i.test(remarks);
  if (isMotivated) return OPPORTUNITY_TYPES.motivatedSeller;
  return OPPORTUNITY_TYPES.standard;
}

export function scoreProperty(listing, market, news, weights = DEFAULT_WEIGHTS) {
  const signals = {};
  const avgDOM = market?.medianDOM || 45;
  const domRatio = listing.dom / avgDOM;
  signals.dom = Math.min(25, Math.round(domRatio > 1 ? (domRatio - 1) * 20 : 0));

  const cuts = listing.priceHistory.length - 1;
  const totalCutPct = listing.priceHistory.length > 1
    ? (listing.priceHistory[0].price - listing.price) / listing.priceHistory[0].price : 0;
  signals.priceReductions = Math.min(20, Math.round(cuts * 5 + totalCutPct * 40));

  const overComp = listing.avgCompPrice > 0
    ? (listing.price - listing.avgCompPrice) / listing.avgCompPrice : 0;
  signals.priceVsComps = overComp < -0.05
    ? Math.min(20, Math.round(Math.abs(overComp) * 60))
    : overComp > 0.15 ? Math.min(10, Math.round(overComp * 30)) : 0;

  const supplyScore = market ? Math.min(15, Math.round((market.monthsSupply / 6) * 10)) : 5;
  signals.inventory = supplyScore;

  let motivationScore = 0;
  if (listing.vacant) motivationScore += 5;
  if (listing.probate) motivationScore += 5;
  if (listing.failedListing || listing.is_price_reduced) motivationScore += 5;
  if (listing.is_foreclosure) motivationScore += 5;
  signals.sellerMotivation = Math.min(15, motivationScore);

  const nearbyNeg = (news || []).filter(n =>
    n.sentiment === "negative" &&
    haversineDistanceMiles(listing.lat, listing.lng, n.lat, n.lng) <= 50
  );
  signals.localNews = Math.min(5, nearbyNeg.reduce((acc, n) => acc + n.severity, 0));

  const rawTotal = signals.dom * weights.dom + signals.priceReductions * weights.priceReductions +
    signals.priceVsComps * weights.priceVsComps + signals.inventory * weights.inventory +
    signals.sellerMotivation * weights.sellerMotivation + signals.localNews * weights.localNews;
  const maxPossible = 25*weights.dom + 20*weights.priceReductions + 20*weights.priceVsComps + 15*weights.inventory + 15*weights.sellerMotivation + 5*weights.localNews;
  const score = Math.round((rawTotal / maxPossible) * 100);

  const financingFlags = parseFinancingFlags(listing.listingRemarks);
  const tempScored = { ...listing, priceHistory: listing.priceHistory || [], financingFlags };
  const opportunityType = classifyOpportunityType(tempScored, financingFlags);

  return {
    ...listing, score, signals,
    grade: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
    financingFlags, opportunityType,
    pricecuts: listing.priceHistory.length - 1,
    totalCutPct: listing.priceHistory.length > 1
      ? Math.round(((listing.priceHistory[0].price - listing.price) / listing.priceHistory[0].price) * 100) : 0,
  };
}

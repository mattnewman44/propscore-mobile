import React, { useState } from "react";
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  Linking, ActivityIndicator,
} from "react-native";
import { useListings, SIGNAL_KEYS, SIGNAL_MAXES, type SignalKey } from "../lib/ListingsContext";
import { scoreProperty, DEFAULT_WEIGHTS } from "../lib/scoring";
import { enrichByAddress, API_BASE } from "../lib/data";

const GRADE = {
  high:   { label: "High Distress",   dot: "#dc2626", bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
  medium: { label: "Medium Distress", dot: "#d97706", bg: "#fffbeb", border: "#fcd34d", text: "#92400e" },
  low:    { label: "Low Distress",    dot: "#16a34a", bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
};

const FLOOD_DETAIL: Record<string, { risk: string; insurance: string; note: string }> = {
  VE:           { risk: "Very High — Coastal",              insurance: "Mandatory (~$3,000–8,000/yr)",          note: "Wave action zone. Strict building codes. Hardest to insure." },
  AE:           { risk: "High — Inland Flood",              insurance: "Mandatory (~$800–3,000/yr)",            note: "Within 100-yr floodplain. NFIP coverage required for federally backed loans." },
  A:            { risk: "High",                             insurance: "Mandatory (~$800–2,000/yr)",            note: "100-yr floodplain, no base flood elevation defined." },
  AO:           { risk: "High — Sheet Flow",                insurance: "Mandatory",                             note: "Shallow flooding, typically 1–3 ft depth." },
  AH:           { risk: "High — Ponding",                   insurance: "Mandatory",                             note: "Ponding water, base flood elevations provided." },
  X:            { risk: "Low to Moderate",                  insurance: "Optional (~$400–900/yr)",               note: "Outside 100-yr floodplain. 26% of NFIP claims come from moderate-risk zones." },
  "X (unshaded)": { risk: "Minimal — No Flood Risk",        insurance: "Optional (~$400–900/yr)",               note: "Outside the 500-year floodplain — FEMA's lowest-risk designation. No flood insurance required for any loan type." },
  "X (shaded)":   { risk: "Moderate — 500-yr Floodplain",  insurance: "Not mandatory, recommended (~$300–900/yr)", note: "0.2% annual chance of flooding. Lower risk than AE but not zero — worth considering a policy." },
  D:            { risk: "Undetermined",                     insurance: "Not available via NFIP",                note: "Flood risk not assessed. Consult local maps." },
};

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function fmtDate(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function statColor(type: string, v: number | null) {
  if (v == null || v === 0) return { bg:"#f5f5f3", border:"#e5e7eb", val:"#6b7280", note:"#9ca3af", bar:"#d1d5db" };
  if (type==="dom")    return v<30 ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v<=60?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  if (type==="cutpct") return v<5  ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v<=10?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  return { bg:"#f5f5f3", border:"#e5e7eb", val:"#374151", note:"#9ca3af", bar:"#d1d5db" };
}

const WEIGHT_STEPS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function SignalBar({ label, baseValue, max, color, weight, onWeight }: {
  label: string; baseValue: number; max: number; color: string;
  weight: number; onWeight: (w: number) => void;
}) {
  const basePct  = Math.min(100, Math.round((baseValue / max) * 100));
  const boostVal = Math.min(max, baseValue * weight) - baseValue;
  const boostPct = Math.max(0, Math.min(100 - basePct, Math.round((boostVal / max) * 100)));
  const userVal  = Math.round(Math.min(max, baseValue * weight));
  const stepDown = () => { const i = WEIGHT_STEPS.indexOf(weight); if (i > 0) onWeight(WEIGHT_STEPS[i - 1]); };
  const stepUp   = () => { const i = WEIGHT_STEPS.indexOf(weight); if (i < WEIGHT_STEPS.length - 1) onWeight(WEIGHT_STEPS[i + 1]); };

  return (
    <View style={sb.row}>
      <View style={sb.labelRow}>
        <Text style={sb.label}>{label}</Text>
        <View style={sb.rightRow}>
          <Text style={[sb.val, { color }]}>{baseValue}<Text style={sb.maxTxt}>/{max}</Text></Text>
          {weight !== 1 && (
            <View style={[sb.weightBadge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
              <Text style={[sb.weightBadgeTxt, { color }]}>{weight}×</Text>
            </View>
          )}
        </View>
      </View>
      <View style={sb.track}>
        <View style={[sb.fill, { width: `${basePct}%` as any, backgroundColor: color }]} />
        {boostPct > 0 && <View style={[sb.fill, { width: `${boostPct}%` as any, backgroundColor: color + "50" }]} />}
      </View>
      <View style={sb.weightRow}>
        <Text style={sb.weightLabel}>Weight</Text>
        <View style={sb.weightControls}>
          <TouchableOpacity style={sb.wBtn} onPress={stepDown} disabled={weight === 0}>
            <Text style={[sb.wBtnTxt, weight === 0 && { color: "#d1d5db" }]}>−</Text>
          </TouchableOpacity>
          <Text style={sb.wVal}>{weight === 1 ? "Default" : `${weight}×`}</Text>
          <TouchableOpacity style={sb.wBtn} onPress={stepUp} disabled={weight === 2}>
            <Text style={[sb.wBtnTxt, weight === 2 && { color: "#d1d5db" }]}>+</Text>
          </TouchableOpacity>
        </View>
        {weight !== 1 && <Text style={[sb.userVal, { color }]}>→ {userVal}/{max}</Text>}
      </View>
    </View>
  );
}

function StatCompareBar({ abbr, label, type, raw, display, barMax, note }: any) {
  const c = statColor(type, raw);
  const fill = raw && barMax ? Math.min(100, Math.round((raw / barMax) * 100)) : 0;
  return (
    <View style={sc.row}>
      <View style={sc.topRow}>
        <View style={sc.labelGroup}>
          <Text style={[sc.abbr, { color: c.note }]}>{abbr}</Text>
          <Text style={sc.label}>{label}</Text>
        </View>
        <Text style={[sc.val, { color: c.val }]}>{display}</Text>
      </View>
      <View style={sc.track}>
        <View style={[sc.fill, { width: `${fill}%` as any, backgroundColor: c.bar }]} />
      </View>
      {!!note && <Text style={[sc.note, { color: c.note }]}>{note}</Text>}
    </View>
  );
}

function Accordion({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={acc.container}>
      <TouchableOpacity style={acc.header} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={acc.title}>{title}</Text>
        {badge ? <Text style={acc.badge}>{badge}</Text> : null}
        <Text style={acc.chevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && <View style={acc.body}>{children}</View>}
    </View>
  );
}

const acc = StyleSheet.create({
  container: { marginHorizontal: 12, marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#f9fafb" },
  title: { flex: 1, fontSize: 13, fontWeight: "700", color: "#374151" },
  badge: { fontSize: 11, color: "#6b7280", marginRight: 8 },
  chevron: { fontSize: 10, color: "#9ca3af" },
  body: { padding: 14, backgroundColor: "#fff" },
});

function fmtFullDate(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDollars(n: number) {
  return `$${n.toLocaleString()}`;
}

function PriceHistoryAccordion({ property }: { property: any }) {
  const ph = property.priceHistory || [];

  // Prefer precomputed listing-cycle fields (populated after Deep Enrich)
  const startPrice  = property.listingStartPrice  || (ph.length > 1 ? ph.find((h: any) => h.event === "Listed")?.price || ph[0].price : null);
  const startDate   = property.listingStartDate   || (ph.length > 1 ? ph.find((h: any) => h.event === "Listed")?.date || ph[0].date : null);
  const dropCount   = property.priceDropCount     ?? (ph.length > 1 ? ph.length - 1 : 0);
  const lastDropAmt = property.lastDropAmount     || 0;
  const lastDropDt  = property.lastDropDate       || null;

  const totalDropAmt   = startPrice && startPrice > property.price ? startPrice - property.price : 0;
  const totalDropPct   = startPrice && totalDropAmt > 0 ? Math.round((totalDropAmt / startPrice) * 100) : 0;

  const badgeLabel = dropCount > 0 ? `${dropCount} drop${dropCount > 1 ? "s" : ""}` : undefined;

  // Current-cycle entries only (events after most recent Listed, or all if no event tags)
  const currentCycleEntries = (() => {
    const hasEvents = ph.some((h: any) => h.event);
    if (!hasEvents) return [...ph].reverse();
    // Find most recent Listed index (reversed = newest first display order)
    const rev = [...ph].reverse();
    const listedIdx = rev.findIndex((h: any) =>
      (h.event || "").toLowerCase() === "listed" || (h.event || "").toLowerCase() === "relisted"
    );
    return listedIdx >= 0 ? rev.slice(0, listedIdx + 1) : rev;
  })();

  return (
    <Accordion title="Price History" badge={badgeLabel}>
      {ph.length === 0 ? (
        <Text style={styles.emptyNote}>No price history available.</Text>
      ) : (
        <>
          {/* Summary header */}
          {startPrice != null && (
            <View style={styles.phSummary}>
              <View style={styles.phSummaryRow}>
                <Text style={styles.phSummaryLabel}>Listed</Text>
                <Text style={styles.phSummaryVal}>{fmtDollars(startPrice)}</Text>
                {startDate && <Text style={styles.phSummaryDate}>{fmtFullDate(startDate)}</Text>}
              </View>
              {dropCount > 0 && (
                <View style={styles.phSummaryRow}>
                  <Text style={[styles.phSummaryLabel, { color: "#dc2626" }]}>{dropCount} price drop{dropCount > 1 ? "s" : ""}</Text>
                  <Text style={[styles.phSummaryVal, { color: "#dc2626" }]}>
                    {totalDropAmt > 0 ? `−${fmtDollars(totalDropAmt)}` : ""}{totalDropPct > 0 ? ` (${totalDropPct}%)` : ""}
                  </Text>
                </View>
              )}
              {lastDropAmt > 0 && lastDropDt && (
                <View style={styles.phSummaryRow}>
                  <Text style={styles.phSummaryLabel}>Last drop</Text>
                  <Text style={styles.phSummaryVal}>−{fmtDollars(lastDropAmt)}</Text>
                  <Text style={styles.phSummaryDate}>{fmtFullDate(lastDropDt)}</Text>
                </View>
              )}
              <View style={[styles.phSummaryRow, { borderTopWidth: 0.5, borderColor: "#e5e7eb", marginTop: 6, paddingTop: 6 }]}>
                <Text style={styles.phSummaryLabel}>Now</Text>
                <Text style={[styles.phSummaryVal, { color: "#111", fontWeight: "700" }]}>{fmtDollars(property.price)}</Text>
              </View>
            </View>
          )}

          {/* Full event list — 5-year window */}
          {(() => {
            const cutoff = Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000;
            const visible = currentCycleEntries.filter((h: any) => { const t = new Date(h.date).getTime(); return isNaN(t) || t >= cutoff; });
            const hidden = currentCycleEntries.length - visible.length;
            return (
          <View style={{ marginTop: 8 }}>
            {visible.map((h: any, i: number) => {
              const next = visible[i + 1];
              const delta = next ? h.price - next.price : null;
              const isListed = (h.event || "").toLowerCase().includes("listed") || (h.event || "").toLowerCase().includes("relisted");
              return (
                <View key={i} style={styles.phRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.phDate}>{fmtFullDate(h.date)}</Text>
                    {h.event && <Text style={styles.phEventLabel}>{h.event}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.phPrice, i === 0 && { color: "#111", fontWeight: "700" }]}>
                      {fmtDollars(h.price)}
                    </Text>
                    {delta != null && Math.abs(delta) > 0 && (
                      <Text style={[styles.phDelta, { color: delta > 0 ? "#dc2626" : "#16a34a" }]}>
                        {delta > 0 ? `▼ −${fmtDollars(delta)}` : `▲ +${fmtDollars(Math.abs(delta))}`}
                      </Text>
                    )}
                    {isListed && <Text style={[styles.phDelta, { color: "#6b7280" }]}>listed</Text>}
                  </View>
                </View>
              );
            })}
            {hidden > 0 && (
              <Text style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", paddingVertical: 6 }}>
                {hidden} older event{hidden !== 1 ? "s" : ""} not shown (5-year window)
              </Text>
            )}
          </View>
            );
          })()}

          {property.last_sold_price && (
            <View style={[styles.phRow, { borderTopWidth: 0.5, borderColor: "#e5e7eb", marginTop: 8, paddingTop: 8 }]}>
              <Text style={styles.phDate}>Last sold {fmtDate(property.last_sold_date)}</Text>
              <Text style={styles.phPrice}>{fmtDollars(property.last_sold_price)}</Text>
            </View>
          )}
        </>
      )}
      {property._offMarket && (property.agentName || property.brokerage) && (
        <View style={[styles.agentMini, { marginTop: 12 }]}>
          <Text style={styles.agentMiniLabel}>Last listed by</Text>
          {property.agentName && <Text style={styles.agentMiniName}>{property.agentName}</Text>}
          {property.brokerage && property.brokerage !== property.agentName && (
            <Text style={styles.agentMiniSub}>{property.brokerage}</Text>
          )}
          {property.agentPhone && (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${property.agentPhone.replace(/\D/g, "")}`)}>
              <Text style={styles.agentMiniPhone}>📞 {property.agentPhone}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Accordion>
  );
}

function AVMAccordion({ property }: { property: any }) {
  const avm = property.avmEstimates;
  if (!avm?.current?.length) return null;

  const best   = avm.current.find((v: any) => v.isBest) || avm.current[0];
  const others = avm.current.filter((v: any) => v !== best);

  // Get 3-month trend for a source
  const getTrend = (sourceName: string) => {
    const hist = avm.historical?.find((h: any) => h.source === sourceName);
    if (!hist?.estimates?.length || hist.estimates.length < 3) return null;
    const recent = hist.estimates.slice(-3);
    const diff = recent[recent.length - 1].estimate - recent[0].estimate;
    return diff > 500 ? "up" : diff < -500 ? "down" : "flat";
  };

  // Quantarium 12-month forecast
  const forecast = avm.forecast?.find((f: any) => f.type === "quantarium") || avm.forecast?.[0];
  const forecastEnd = forecast?.estimates?.[forecast.estimates.length - 1];

  const trendIcon = (t: string | null) =>
    t === "up" ? " ↑" : t === "down" ? " ↓" : t === "flat" ? " →" : "";

  return (
    <Accordion title="Valuations" badge="3 sources">
      <Text style={styles.avmNote}>Independent automated valuations from Realtor.com</Text>

      {/* Best estimate highlighted */}
      <View style={styles.avmBestRow}>
        <View>
          <Text style={styles.avmBestSource}>{best.source}</Text>
          <Text style={styles.avmBestLabel}>Best estimate</Text>
        </View>
        <Text style={styles.avmBestVal}>
          {fmtDollars(best.estimate)}{trendIcon(getTrend(best.source))}
        </Text>
      </View>

      {/* Other two estimates */}
      {others.map((v: any) => (
        <View key={v.source} style={styles.avmRow}>
          <Text style={styles.avmSource}>{v.source}</Text>
          <Text style={styles.avmVal}>
            {fmtDollars(v.estimate)}{trendIcon(getTrend(v.source))}
          </Text>
        </View>
      ))}

      {/* List price vs best AVM */}
      {best.estimate > 0 && property.price > 0 && (() => {
        const diff = best.estimate - property.price;
        const pct  = Math.round(Math.abs(diff) / best.estimate * 100);
        const below = diff > 0;
        return (
          <View style={[styles.avmDiffRow, { backgroundColor: below ? "#f0fdf4" : "#fef2f2", borderColor: below ? "#86efac" : "#fca5a5" }]}>
            <Text style={[styles.avmDiffText, { color: below ? "#15803d" : "#991b1b" }]}>
              {below
                ? `Listed ${pct}% below best AVM (${fmtDollars(diff)} discount)`
                : `Listed ${pct}% above best AVM`}
            </Text>
          </View>
        );
      })()}

      {/* 12-month forecast */}
      {forecastEnd && (
        <View style={styles.avmForecastRow}>
          <Text style={styles.avmForecastLabel}>12-mo forecast ({forecast.source})</Text>
          <Text style={styles.avmForecastVal}>{fmtDollars(forecastEnd.estimate)}</Text>
          <Text style={styles.avmForecastDate}>by {fmtDate(forecastEnd.date)}</Text>
        </View>
      )}
    </Accordion>
  );
}

function EnrichedAccordion({ property }: { property: any }) {
  const opp = property.opportunityType;
  const flood = property.floodZone;
  const floodInfo = flood ? FLOOD_DETAIL[flood] || FLOOD_DETAIL[flood.replace(/\s*\(.*\)/, "").trim()] || FLOOD_DETAIL["X"] : null;
  const flags = property.financingFlags || [];

  return (
    <Accordion title="Deal Details">
      {opp && (
        <View style={[styles.oppExpanded, { backgroundColor: opp.bg, borderColor: opp.border }]}>
          <View style={styles.oppExpandedHeader}>
            <Text style={styles.oppExpandedIcon}>{opp.icon}</Text>
            <View>
              <Text style={[styles.oppExpandedLabel, { color: opp.color }]}>{opp.label}</Text>
              <Text style={styles.oppExpandedSub}>{opp.sublabel}</Text>
            </View>
          </View>
          {opp.description && <Text style={styles.oppExpandedDesc}>{opp.description}</Text>}
          {opp.negotiability && (
            <View style={styles.oppMeta}>
              <Text style={styles.oppMetaItem}>Negotiability: <Text style={{ fontWeight: "600" }}>{opp.negotiability}</Text></Text>
              <Text style={styles.oppMetaItem}>Timeline: <Text style={{ fontWeight: "600" }}>{opp.timeline}</Text></Text>
            </View>
          )}
          {opp.tip && (
            <View style={styles.oppTip}>
              <Text style={styles.oppTipText}>💡 {opp.tip}</Text>
            </View>
          )}
        </View>
      )}

      {floodInfo && (
        <View style={[styles.floodExpanded, { marginTop: opp ? 12 : 0 }]}>
          <Text style={styles.floodExpandedTitle}>🌊 Flood Zone {flood}</Text>
          <Text style={styles.floodExpandedRisk}>Risk: {floodInfo.risk}</Text>
          <Text style={styles.floodExpandedNote}>{floodInfo.note}</Text>
          <Text style={styles.floodExpandedIns}>Insurance: {floodInfo.insurance}</Text>
        </View>
      )}

      {flags.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.subLabel}>Financing & Condition Flags</Text>
          <View style={styles.flagsRow}>
            {flags.map((f: any) => (
              <View key={f.key} style={[styles.flag, { backgroundColor: f.bg }]}>
                <Text style={[styles.flagText, { color: f.color }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {property.listingRemarks ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.subLabel}>Listing Remarks</Text>
          <Text style={styles.remarksText}>{property.listingRemarks}</Text>
        </View>
      ) : null}
    </Accordion>
  );
}

function CompsAccordion({ property, onViewCompsOnMap }: { property: any; onViewCompsOnMap?: (comps: any[]) => void }) {
  const [comps, setComps]     = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const loadComps = async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        zip:   property.zip   || "",
        city:  property.city  || "",
        state: property.state || "",
      });
      if (property.id)        params.set("listingId", String(property.id));
      if (property.bedrooms)  params.set("beds",     String(property.bedrooms));
      if (property.bathrooms) params.set("baths",    String(property.bathrooms));
      if (property.sqft)      params.set("sqft",     String(property.sqft));
      if (property.propType)  params.set("propType", String(property.propType));
      const res  = await fetch(`${API_BASE}/api/sold-comps?${params}`);
      const json = await res.json();
      setComps(json.comps || json || []);
      setLoaded(true);
    } catch (e: any) {
      setError("Failed to load comps");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Accordion title="Sold Comps" badge={loaded && comps.length > 0 ? `${comps.length} found` : undefined}>
      {!loaded && !loading && (
        <TouchableOpacity style={styles.loadCompsBtn} onPress={loadComps}>
          <Text style={styles.loadCompsBtnText}>Load sold comps</Text>
        </TouchableOpacity>
      )}
      {loading && (
        <View style={styles.compsCenter}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.compsNote}>Searching nearby sold comps…</Text>
        </View>
      )}
      {error && <Text style={styles.compsError}>{error}</Text>}
      {loaded && comps.length === 0 && (
        <Text style={styles.emptyNote}>No sold comps found for this ZIP.</Text>
      )}
      {loaded && comps.length > 0 && onViewCompsOnMap && (
        <TouchableOpacity
          style={styles.viewOnMapBtn}
          onPress={() => onViewCompsOnMap(comps.filter((c: any) => c.lat && c.lng))}
        >
          <Text style={styles.viewOnMapBtnText}>🗺 View comps on map</Text>
        </TouchableOpacity>
      )}
      {comps.map((c: any, i: number) => {
        const matchPct = c.criteria_met != null ? Math.round((c.criteria_met / 8) * 100) : null;
        const matchColor = matchPct == null ? "#9ca3af" : matchPct >= 75 ? "#15803d" : matchPct >= 50 ? "#d97706" : "#dc2626";
        return (
          <View key={i} style={styles.compRow}>
            <View style={styles.compTop}>
              <Text style={styles.compAddr} numberOfLines={1}>{c.address}</Text>
              {matchPct != null && (
                <View style={[styles.matchBadge, { backgroundColor: matchColor + "20", borderColor: matchColor + "60" }]}>
                  <Text style={[styles.matchBadgeTxt, { color: matchColor }]}>{matchPct}%</Text>
                </View>
              )}
            </View>
            <View style={styles.compMeta}>
              <Text style={styles.compPrice}>{fmtPrice(c.sold_price)}</Text>
              <Text style={styles.compDot}>·</Text>
              <Text style={styles.compDetail}>{fmtDate(c.sold_date)}</Text>
              {c.bedrooms > 0 && <>
                <Text style={styles.compDot}>·</Text>
                <Text style={styles.compDetail}>{c.bedrooms}bd/{c.bathrooms}ba</Text>
              </>}
              {c.sqft && <>
                <Text style={styles.compDot}>·</Text>
                <Text style={styles.compDetail}>{c.sqft.toLocaleString()} sqft</Text>
              </>}
              {c.distance != null && <>
                <Text style={styles.compDot}>·</Text>
                <Text style={styles.compDetail}>{c.distance.toFixed(1)} mi</Text>
              </>}
            </View>
            {c.missed_criteria?.length > 0 && (
              <Text style={styles.compMissed}>Missing: {c.missed_criteria.join(", ")}</Text>
            )}
          </View>
        );
      })}
    </Accordion>
  );
}

function DeepEnrichButton({ property, onEnriched }: { property: any; onEnriched: (fields: any) => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleEnrich = async () => {
    setStatus("loading");
    try {
      const fields = await enrichByAddress(property);
      if (fields) {
        onEnriched(fields);
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <View style={styles.enrichDone}>
        <Text style={styles.enrichDoneText}>✓ Enriched with fresh data</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.enrichBtn, status === "loading" && { opacity: 0.7 }]}
      onPress={handleEnrich}
      disabled={status === "loading"}
    >
      {status === "loading"
        ? <ActivityIndicator size="small" color="#fff" />
        : <Text style={styles.enrichBtnText}>{status === "error" ? "Retry Enrich" : "🔍 Deep Enrich"}</Text>
      }
    </TouchableOpacity>
  );
}

const SIGNAL_CONFIG = [
  { key: "dom" as SignalKey,             label: "Days on market",    max: 25 },
  { key: "priceReductions" as SignalKey, label: "Price reductions",  max: 20 },
  { key: "priceVsComps" as SignalKey,    label: "Price vs comps",    max: 20 },
  { key: "inventory" as SignalKey,       label: "Inventory",         max: 15 },
  { key: "sellerMotivation" as SignalKey,label: "Seller motivation", max: 15 },
  { key: "localNews" as SignalKey,       label: "Local news",        max:  5 },
];

interface Props {
  property: any;
  onClose: () => void;
  saved?: boolean;
  onToggleSaved?: () => void;
  onViewCompsOnMap?: (comps: any[]) => void;
}

export default function DetailSheet({ property, onClose, saved = false, onToggleSaved, onViewCompsOnMap }: Props) {
  const { marketStats, marketData, avgCutPct, avgDOM, weights, setWeights, hasCustomWeights, news } = useListings();

  // Local copy — updated by deep enrich without requiring parent state update
  const [localProp, setLocalProp] = useState<any>(null);
  const prop = localProp || property;

  if (!prop) return null;

  const setWeight = (key: SignalKey, w: number) => setWeights(prev => ({ ...prev, [key]: w }));

  const handleEnriched = (fields: any) => {
    const merged = { ...prop, ...fields };
    // Re-score with updated fields
    const rescored = scoreProperty(merged, marketData || {}, news, DEFAULT_WEIGHTS);
    setLocalProp({ ...merged, ...rescored, _enriched: true });
  };

  const baseSignals = prop.signals || {};
  const propScoreRaw = SIGNAL_CONFIG.reduce((sum, s) => sum + (baseSignals[s.key] || 0), 0);
  const propScoreMax = SIGNAL_CONFIG.reduce((sum, s) => sum + s.max, 0);
  const propScore    = propScoreMax > 0 ? Math.round((propScoreRaw / propScoreMax) * 100) : prop.score;

  const userRaw     = SIGNAL_CONFIG.reduce((sum, s) => sum + (baseSignals[s.key] || 0) * weights[s.key], 0);
  const userMaxPoss = SIGNAL_CONFIG.reduce((sum, s) => sum + s.max * weights[s.key], 0);
  const userScore   = userMaxPoss > 0 ? Math.round((userRaw / userMaxPoss) * 100) : propScore;

  const g = GRADE[prop.grade as keyof typeof GRADE] || GRADE.low;
  const ph = prop.priceHistory || [];
  const origPrice = ph.length > 1 ? Math.max(...ph.map((h: any) => h.price)) : 0;
  const cutPct = origPrice > prop.price
    ? Math.round((origPrice - prop.price) / origPrice * 100)
    : (prop.totalCutPct || 0);

  const propDM = prop.dom ?? null;
  const PROP_STATS = [
    { abbr: "DM", label: "Days on Market", type: "dom", raw: propDM, display: propDM != null ? `${propDM} days` : "—", barMax: 120, note: avgDOM != null ? `Metro avg: ${avgDOM} days` : "" },
    { abbr: "AC", label: "Price Cut", type: "cutpct", raw: cutPct || null, display: cutPct > 0 ? `-${cutPct}%` : "No cuts", barMax: 25, note: avgCutPct > 0 ? `Metro avg: ${avgCutPct}%` : "" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{prop.address}</Text>
        <View style={styles.headerRight}>
          {prop._refreshing && <Text style={styles.refreshing}>⟳ Refreshing…</Text>}
          {prop._refreshedAt && !prop._refreshing && <Text style={styles.refreshed}>↻ Refreshed</Text>}
          {prop._enriched && <Text style={styles.refreshed}>✓ Enriched</Text>}
          {onToggleSaved && (
            <TouchableOpacity onPress={onToggleSaved} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
              <Text style={styles.heart}>{saved ? "❤️" : "🤍"}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {prop.photo_url && (
          <Image source={{ uri: prop.photo_url }} style={styles.photo} />
        )}

        {/* Grade box */}
        <View style={[styles.gradeBox, { backgroundColor: g.bg, borderColor: g.border }]}>
          <View style={styles.gradeTop}>
            <View style={[styles.dot, { backgroundColor: g.dot }]} />
            <Text style={[styles.gradeLabel, { color: g.text }]}>{g.label}</Text>
            <Text style={[styles.score, { color: g.dot }]}>{prop.score}</Text>
          </View>
          <Text style={styles.address}>{prop.address}</Text>
          {prop.city ? <Text style={styles.cityState}>{prop.city}, {prop.state} {prop.zip}</Text> : null}
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{fmtPrice(prop.price)}</Text>
            {prop.bedrooms > 0 && (
              <Text style={styles.meta}>
                {prop.bedrooms}bd · {prop.bathrooms}ba{prop.sqft ? ` · ${prop.sqft.toLocaleString()} sqft` : ""}
              </Text>
            )}
            {prop._offMarket
              ? <Text style={[styles.meta, { color: "#6b7280", fontWeight: "600" }]}>⚪ Off Market</Text>
              : prop.dom > 0 && <Text style={styles.meta}>{prop.dom} days on market</Text>
            }
            {cutPct > 0 && <Text style={[styles.meta, { color: g.dot }]}>-{cutPct}% price cut</Text>}
          </View>
        </View>

        {/* Opportunity type (compact) */}
        {prop.opportunityType && (
          <View style={[styles.oppBox, { backgroundColor: prop.opportunityType.bg, borderColor: prop.opportunityType.border }]}>
            <Text style={styles.oppIcon}>{prop.opportunityType.icon}</Text>
            <View>
              <Text style={[styles.oppLabel, { color: prop.opportunityType.color }]}>{prop.opportunityType.label}</Text>
              <Text style={styles.oppSub}>{prop.opportunityType.sublabel}</Text>
            </View>
          </View>
        )}

        {/* Off-market agent contact */}
        {prop._offMarket && (prop.agentName || prop.brokerage) && (
          <View style={styles.agentBox}>
            <Text style={styles.agentHeading}>📋 Last Listed By</Text>
            {prop.agentName && <Text style={styles.agentName}>{prop.agentName}</Text>}
            {prop.brokerage && prop.brokerage !== prop.agentName && (
              <Text style={styles.agentBrokerage}>{prop.brokerage}</Text>
            )}
            {prop.agentPhone && (
              <TouchableOpacity style={styles.agentCallBtn}
                onPress={() => Linking.openURL(`tel:${prop.agentPhone.replace(/\D/g, "")}`)}>
                <Text style={styles.agentCallText}>📞 {prop.agentPhone}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Flood zone (compact) */}
        {prop.floodZone && (
          <View style={styles.floodBox}>
            <Text style={styles.floodText}>🌊 Flood Zone: {prop.floodZone}</Text>
          </View>
        )}

        {/* Financing flags (compact) */}
        {prop.financingFlags?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.flags}>
              {prop.financingFlags.map((f: any) => (
                <View key={f.key} style={[styles.flag, { backgroundColor: f.bg }]}>
                  <Text style={[styles.flagText, { color: f.color }]}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Signal breakdown */}
        <View style={styles.section}>
          <View style={sb.scoreHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Signal breakdown</Text>
            {hasCustomWeights && (
              <View style={sb.scoreComparePill}>
                <Text style={sb.scoreCompareBase}>PropScore: {propScore}</Text>
                <Text style={sb.scoreCompareSep}>→</Text>
                <Text style={[sb.scoreCompareUser, { color: g.dot }]}>Your Score: {userScore}</Text>
              </View>
            )}
          </View>
          {SIGNAL_CONFIG.map(sig => (
            <SignalBar
              key={sig.key}
              label={sig.label}
              baseValue={baseSignals[sig.key] || 0}
              max={sig.max}
              color={g.dot}
              weight={weights[sig.key]}
              onWeight={w => setWeight(sig.key, w)}
            />
          ))}
          <View style={sb.legend}>
            <View style={sb.legendItem}>
              <View style={[sb.legendSwatch, { backgroundColor: g.dot }]} />
              <Text style={sb.legendTxt}>PropScore</Text>
            </View>
            <View style={sb.legendItem}>
              <View style={[sb.legendSwatch, { backgroundColor: g.dot + "50" }]} />
              <Text style={sb.legendTxt}>User Score</Text>
            </View>
          </View>
        </View>

        {/* Metro vs This Property */}
        {marketStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {marketData?.metroName || marketData?.stateAbbr || "Local"} Market
            </Text>
            {marketStats.map((s: any) => <StatCompareBar key={s.abbr} {...s} />)}
            <View style={styles.divider} />
            <Text style={[styles.sectionTitle, { marginTop: 4 }]}>This Property</Text>
            {PROP_STATS.map((s: any) => <StatCompareBar key={s.abbr} {...s} />)}
          </View>
        )}

        {/* Accordions */}
        <PriceHistoryAccordion property={prop} />
        <AVMAccordion property={prop} />
        <EnrichedAccordion property={prop} />
        <CompsAccordion property={prop} onViewCompsOnMap={onViewCompsOnMap} />

        {/* Deep Enrich */}
        <View style={{ marginHorizontal: 12, marginTop: 12 }}>
          <DeepEnrichButton property={prop} onEnriched={handleEnriched} />
        </View>

        {/* Zillow / listing link */}
        {prop.zillowUrl && (
          <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(prop.zillowUrl)}>
            <Text style={styles.linkBtnText}>View listing ↗</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── StyleSheets ───────────────────────────────────────────────────────────────

const sb = StyleSheet.create({
  row: { marginBottom: 14 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  rightRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 13, color: "#374151" },
  val: { fontSize: 13, fontWeight: "600" },
  maxTxt: { fontSize: 11, fontWeight: "400", color: "#9ca3af" },
  track: { height: 7, backgroundColor: "#f3f4f6", borderRadius: 3.5, overflow: "hidden", flexDirection: "row" },
  fill: { height: 7, borderRadius: 3.5 },
  weightRow: { flexDirection: "row", alignItems: "center", marginTop: 5, gap: 8 },
  weightLabel: { fontSize: 11, color: "#9ca3af", width: 40 },
  weightControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  wBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  wBtnTxt: { fontSize: 14, color: "#374151", lineHeight: 18 },
  wVal: { fontSize: 11, color: "#374151", fontWeight: "600", minWidth: 52, textAlign: "center" },
  userVal: { fontSize: 11, fontWeight: "700" },
  weightBadge: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 1 },
  weightBadgeTxt: { fontSize: 10, fontWeight: "700" },
  scoreHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  scoreComparePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  scoreCompareBase: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  scoreCompareSep:  { fontSize: 11, color: "#9ca3af" },
  scoreCompareUser: { fontSize: 11, fontWeight: "700" },
  legend: { flexDirection: "row", gap: 14, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendTxt: { fontSize: 11, color: "#6b7280" },
});

const sc = StyleSheet.create({
  row: { marginBottom: 16 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  labelGroup: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  abbr: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  label: { fontSize: 13, color: "#374151" },
  val: { fontSize: 16, fontWeight: "700" },
  track: { height: 8, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  note: { fontSize: 11, marginTop: 3 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  handle: { width: 36, height: 4, backgroundColor: "#d1d5db", borderRadius: 2, alignSelf: "center", marginTop: 8, marginBottom: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderColor: "#e5e7eb" },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#111", marginRight: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  refreshing: { fontSize: 11, color: "#6b7280" },
  refreshed:  { fontSize: 11, color: "#15803d", fontWeight: "600" },
  heart: { fontSize: 18 },
  closeBtn: { fontSize: 18, color: "#6b7280" },
  scroll: { flex: 1 },
  photo: { width: "100%", height: 200 },

  gradeBox: { margin: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  gradeTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  gradeLabel: { fontSize: 14, fontWeight: "600", flex: 1 },
  score: { fontSize: 22, fontWeight: "800" },
  address: { fontSize: 15, fontWeight: "600", color: "#111" },
  cityState: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  meta: { fontSize: 13, color: "#374151" },

  oppBox: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  oppIcon: { fontSize: 22 },
  oppLabel: { fontSize: 14, fontWeight: "700" },
  oppSub: { fontSize: 12, color: "#6b7280" },

  floodBox: { marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", padding: 10 },
  floodText: { fontSize: 13, fontWeight: "600", color: "#1d4ed8" },

  agentBox: { marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb", padding: 12 },
  agentHeading: { fontSize: 11, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  agentName: { fontSize: 15, fontWeight: "700", color: "#111", marginBottom: 2 },
  agentBrokerage: { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  agentCallBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  agentCallText: { fontSize: 14, fontWeight: "600", color: "#2563eb" },

  section: { marginHorizontal: 12, marginTop: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  divider: { height: 0.5, backgroundColor: "#e5e7eb", marginVertical: 16 },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  flagText: { fontSize: 12, fontWeight: "600" },

  // Price history
  phRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 7, borderBottomWidth: 0.5, borderColor: "#f3f4f6" },
  phDate: { fontSize: 13, color: "#6b7280" },
  phEventLabel: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  phPrice: { fontSize: 13, color: "#374151" },
  phDelta: { fontSize: 11, marginTop: 2 },
  // Price history summary header
  phSummary: { backgroundColor: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: "#e5e7eb" },
  phSummaryRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  phSummaryLabel: { fontSize: 12, color: "#6b7280", width: 80 },
  phSummaryVal: { fontSize: 13, fontWeight: "600", color: "#111" },
  phSummaryDate: { fontSize: 12, color: "#9ca3af", flex: 1, textAlign: "right" },
  // AVM accordion
  avmNote: { fontSize: 12, color: "#9ca3af", marginBottom: 12 },
  avmBestRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#eff6ff", borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: "#bfdbfe" },
  avmBestSource: { fontSize: 13, fontWeight: "700", color: "#1d4ed8" },
  avmBestLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  avmBestVal: { fontSize: 18, fontWeight: "800", color: "#1d4ed8" },
  avmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5, borderColor: "#f3f4f6" },
  avmSource: { fontSize: 13, color: "#374151" },
  avmVal: { fontSize: 14, fontWeight: "600", color: "#111" },
  avmDiffRow: { borderRadius: 6, padding: 10, marginTop: 10, borderWidth: 0.5 },
  avmDiffText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  avmForecastRow: { marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderColor: "#e5e7eb" },
  avmForecastLabel: { fontSize: 11, color: "#9ca3af", marginBottom: 2 },
  avmForecastVal: { fontSize: 15, fontWeight: "700", color: "#111" },
  avmForecastDate: { fontSize: 11, color: "#6b7280", marginTop: 2 },

  agentMini: { borderTopWidth: 0.5, borderColor: "#e5e7eb", paddingTop: 12 },
  agentMiniLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  agentMiniName: { fontSize: 14, fontWeight: "700", color: "#111" },
  agentMiniSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  agentMiniPhone: { fontSize: 13, color: "#2563eb", fontWeight: "600", marginTop: 6 },

  // Enriched/deal details accordion
  oppExpanded: { borderRadius: 10, borderWidth: 1, padding: 12 },
  oppExpandedHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  oppExpandedIcon: { fontSize: 24 },
  oppExpandedLabel: { fontSize: 15, fontWeight: "700" },
  oppExpandedSub: { fontSize: 12, color: "#6b7280" },
  oppExpandedDesc: { fontSize: 13, color: "#374151", lineHeight: 19, marginBottom: 8 },
  oppMeta: { flexDirection: "row", gap: 12, marginBottom: 8 },
  oppMetaItem: { fontSize: 12, color: "#6b7280" },
  oppTip: { backgroundColor: "#fffbeb", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#fcd34d" },
  oppTipText: { fontSize: 12, color: "#92400e", lineHeight: 18 },

  floodExpanded: { backgroundColor: "#eff6ff", borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", padding: 12 },
  floodExpandedTitle: { fontSize: 14, fontWeight: "700", color: "#1d4ed8", marginBottom: 6 },
  floodExpandedRisk: { fontSize: 13, color: "#1e40af", fontWeight: "600", marginBottom: 2 },
  floodExpandedNote: { fontSize: 12, color: "#374151", lineHeight: 18, marginBottom: 4 },
  floodExpandedIns: { fontSize: 12, color: "#6b7280" },

  subLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  flagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  remarksText: { fontSize: 13, color: "#374151", lineHeight: 20 },

  // Comps
  loadCompsBtn: { backgroundColor: "#2563eb", borderRadius: 8, padding: 12, alignItems: "center" },
  loadCompsBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  viewOnMapBtn: { backgroundColor: "#f0f9ff", borderWidth: 1, borderColor: "#bae6fd", borderRadius: 8, padding: 10, alignItems: "center", marginBottom: 10 },
  viewOnMapBtnText: { color: "#0369a1", fontSize: 13, fontWeight: "600" },
  compsCenter: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
  compsNote: { fontSize: 13, color: "#6b7280" },
  compsError: { fontSize: 13, color: "#dc2626" },
  compRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderColor: "#f3f4f6" },
  compTop: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  compAddr: { flex: 1, fontSize: 13, fontWeight: "600", color: "#111" },
  matchBadge: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
  matchBadgeTxt: { fontSize: 10, fontWeight: "700" },
  compMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" },
  compPrice: { fontSize: 13, fontWeight: "700", color: "#111" },
  compDot: { fontSize: 11, color: "#d1d5db" },
  compDetail: { fontSize: 12, color: "#6b7280" },
  compMissed: { fontSize: 11, color: "#9ca3af", marginTop: 3 },

  emptyNote: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 8 },

  // Deep enrich
  enrichBtn: { backgroundColor: "#374151", borderRadius: 10, padding: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  enrichBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  enrichDone: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#86efac" },
  enrichDoneText: { color: "#15803d", fontSize: 14, fontWeight: "600" },

  linkBtn: { marginHorizontal: 12, marginTop: 12, backgroundColor: "#111", borderRadius: 10, padding: 14, alignItems: "center" },
  linkBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});

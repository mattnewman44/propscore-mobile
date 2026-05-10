import React from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useListings } from "../lib/ListingsContext";

const GRADE = {
  high:   { label: "High Distress",   dot: "#dc2626", bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
  medium: { label: "Medium Distress", dot: "#d97706", bg: "#fffbeb", border: "#fcd34d", text: "#92400e" },
  low:    { label: "Low Distress",    dot: "#16a34a", bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
};

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function statColor(type: string, v: number | null) {
  if (v == null || v === 0) return { bg:"#f5f5f3", border:"#e5e7eb", val:"#6b7280", note:"#9ca3af", bar:"#d1d5db" };
  if (type==="dom")    return v<30 ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v<=60?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  if (type==="cutpct") return v<5  ?{bg:"#f0fdf4",border:"#86efac",val:"#15803d",note:"#16a34a",bar:"#16a34a"}:v<=10?{bg:"#fffbeb",border:"#fcd34d",val:"#92400e",note:"#d97706",bar:"#d97706"}:{bg:"#fef2f2",border:"#fca5a5",val:"#991b1b",note:"#dc2626",bar:"#dc2626"};
  return { bg:"#f5f5f3", border:"#e5e7eb", val:"#374151", note:"#9ca3af", bar:"#d1d5db" };
}

function SignalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={sb.row}>
      <View style={sb.labelRow}>
        <Text style={sb.label}>{label}</Text>
        <Text style={[sb.val, { color }]}>{value}</Text>
      </View>
      <View style={sb.track}>
        <View style={[sb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
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

const sb = StyleSheet.create({
  row: { marginBottom: 10 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontSize: 13, color: "#374151" },
  val: { fontSize: 13, fontWeight: "600" },
  track: { height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
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

interface Props {
  property: any;
  onClose: () => void;
  saved?: boolean;
  onToggleSaved?: () => void;
}

export default function DetailSheet({ property, onClose, saved = false, onToggleSaved }: Props) {
  const { marketStats, avgCutPct, avgDOM } = useListings();
  if (!property) return null;

  const g = GRADE[property.grade as keyof typeof GRADE] || GRADE.low;
  const ph = property.priceHistory || [];
  const origPrice = ph.length > 1 ? Math.max(...ph.map((h: any) => h.price)) : 0;
  const cutPct = origPrice > property.price
    ? Math.round((origPrice - property.price) / origPrice * 100)
    : (property.totalCutPct || 0);

  // This Property comparison stats
  const propDM = property.dom ?? null;
  const PROP_STATS = [
    {
      abbr: "DM", label: "Days on Market", type: "dom",
      raw: propDM,
      display: propDM != null ? `${propDM} days` : "—",
      barMax: 120,
      note: avgDOM != null ? `Metro avg: ${avgDOM} days` : "",
    },
    {
      abbr: "AC", label: "Price Cut", type: "cutpct",
      raw: cutPct || null,
      display: cutPct > 0 ? `-${cutPct}%` : "No cuts",
      barMax: 25,
      note: avgCutPct > 0 ? `Metro avg: ${avgCutPct}%` : "",
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{property.address}</Text>
        <View style={styles.headerRight}>
          {property._refreshing && (
            <Text style={styles.refreshing}>⟳ Refreshing…</Text>
          )}
          {property._refreshedAt && !property._refreshing && (
            <Text style={styles.refreshed}>↻ Refreshed</Text>
          )}
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
        {property.photo_url && (
          <Image source={{ uri: property.photo_url }} style={styles.photo} />
        )}

        {/* Grade box */}
        <View style={[styles.gradeBox, { backgroundColor: g.bg, borderColor: g.border }]}>
          <View style={styles.gradeTop}>
            <View style={[styles.dot, { backgroundColor: g.dot }]} />
            <Text style={[styles.gradeLabel, { color: g.text }]}>{g.label}</Text>
            <Text style={[styles.score, { color: g.dot }]}>{property.score}</Text>
          </View>
          <Text style={styles.address}>{property.address}</Text>
          {property.city ? <Text style={styles.cityState}>{property.city}, {property.state} {property.zip}</Text> : null}
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{fmtPrice(property.price)}</Text>
            {property.bedrooms > 0 && (
              <Text style={styles.meta}>
                {property.bedrooms}bd · {property.bathrooms}ba{property.sqft ? ` · ${property.sqft.toLocaleString()} sqft` : ""}
              </Text>
            )}
            {property.dom > 0 && <Text style={styles.meta}>{property.dom} days on market</Text>}
            {cutPct > 0 && <Text style={[styles.meta, { color: g.dot }]}>-{cutPct}% price cut</Text>}
          </View>
        </View>

        {/* Opportunity type */}
        {property.opportunityType && (
          <View style={[styles.oppBox, { backgroundColor: property.opportunityType.bg, borderColor: property.opportunityType.border }]}>
            <Text style={styles.oppIcon}>{property.opportunityType.icon}</Text>
            <View>
              <Text style={[styles.oppLabel, { color: property.opportunityType.color }]}>{property.opportunityType.label}</Text>
              <Text style={styles.oppSub}>{property.opportunityType.sublabel}</Text>
            </View>
          </View>
        )}

        {/* Flood zone */}
        {property.floodZone && (
          <View style={styles.floodBox}>
            <Text style={styles.floodText}>🌊 Flood Zone: {property.floodZone}</Text>
          </View>
        )}

        {/* Financing flags */}
        {property.financingFlags?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financing flags</Text>
            <View style={styles.flags}>
              {property.financingFlags.map((f: any) => (
                <View key={f.key} style={[styles.flag, { backgroundColor: f.bg }]}>
                  <Text style={[styles.flagText, { color: f.color }]}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Signal breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signal breakdown</Text>
          <SignalBar label="Days on market"    value={property.signals?.dom || 0}              max={25} color={g.dot} />
          <SignalBar label="Price reductions"  value={property.signals?.priceReductions || 0}  max={20} color={g.dot} />
          <SignalBar label="Price vs comps"    value={property.signals?.priceVsComps || 0}     max={20} color={g.dot} />
          <SignalBar label="Inventory"         value={property.signals?.inventory || 0}        max={15} color={g.dot} />
          <SignalBar label="Seller motivation" value={property.signals?.sellerMotivation || 0} max={15} color={g.dot} />
        </View>

        {/* Metro Market vs This Property */}
        {marketStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Metro Market</Text>
            {marketStats.map((s: any) => <StatCompareBar key={s.abbr} {...s} />)}
            <View style={styles.divider} />
            <Text style={[styles.sectionTitle, { marginTop: 4 }]}>This Property</Text>
            {PROP_STATS.map((s: any) => <StatCompareBar key={s.abbr} {...s} />)}
          </View>
        )}

        {/* Listing remarks */}
        {property.listingRemarks ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Listing remarks</Text>
            <Text style={styles.remarks}>{property.listingRemarks.slice(0, 400)}{property.listingRemarks.length > 400 ? "…" : ""}</Text>
          </View>
        ) : null}

        {/* Zillow link */}
        {property.zillowUrl && (
          <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(property.zillowUrl)}>
            <Text style={styles.linkBtnText}>View on Zillow ↗</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

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
  section: { marginHorizontal: 12, marginTop: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  divider: { height: 0.5, backgroundColor: "#e5e7eb", marginVertical: 16 },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  flagText: { fontSize: 12, fontWeight: "600" },
  remarks: { fontSize: 13, color: "#374151", lineHeight: 20 },
  linkBtn: { marginHorizontal: 12, marginTop: 16, backgroundColor: "#111", borderRadius: 10, padding: 14, alignItems: "center" },
  linkBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});

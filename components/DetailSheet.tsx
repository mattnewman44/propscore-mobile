import React from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";

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

function SignalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={sb.row}>
      <View style={sb.labelRow}>
        <Text style={sb.label}>{label}</Text>
        <Text style={[sb.val, { color }]}>{value}</Text>
      </View>
      <View style={sb.track}>
        <View style={[sb.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
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

export default function DetailSheet({ property, onClose }: { property: any; onClose: () => void }) {
  if (!property) return null;
  const g = GRADE[property.grade as keyof typeof GRADE] || GRADE.low;
  const cutPct = property.priceHistory?.length > 1
    ? Math.round((property.priceHistory[0].price - property.price) / property.priceHistory[0].price * 100)
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Property Detail</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {property.photo_url && (
          <Image source={{ uri: property.photo_url }} style={styles.photo} />
        )}

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
            {property.bedrooms > 0 && <Text style={styles.meta}>{property.bedrooms}bd · {property.bathrooms}ba</Text>}
            {property.dom > 0 && <Text style={styles.meta}>{property.dom} days on market</Text>}
            {cutPct > 0 && <Text style={[styles.meta, { color: g.dot }]}>-{cutPct}% price cut</Text>}
          </View>
        </View>

        {property.opportunityType && (
          <View style={[styles.oppBox, { backgroundColor: property.opportunityType.bg, borderColor: property.opportunityType.border }]}>
            <Text style={styles.oppIcon}>{property.opportunityType.icon}</Text>
            <View>
              <Text style={[styles.oppLabel, { color: property.opportunityType.color }]}>{property.opportunityType.label}</Text>
              <Text style={styles.oppSub}>{property.opportunityType.sublabel}</Text>
            </View>
          </View>
        )}

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signal breakdown</Text>
          <SignalBar label="Days on market"    value={property.signals?.dom || 0}              max={25} color={g.dot} />
          <SignalBar label="Price reductions"  value={property.signals?.priceReductions || 0}  max={20} color={g.dot} />
          <SignalBar label="Price vs comps"    value={property.signals?.priceVsComps || 0}     max={20} color={g.dot} />
          <SignalBar label="Inventory"         value={property.signals?.inventory || 0}        max={15} color={g.dot} />
          <SignalBar label="Seller motivation" value={property.signals?.sellerMotivation || 0} max={15} color={g.dot} />
        </View>

        {property.listingRemarks ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Listing remarks</Text>
            <Text style={styles.remarks}>{property.listingRemarks.slice(0, 400)}{property.listingRemarks.length > 400 ? "…" : ""}</Text>
          </View>
        ) : null}

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
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
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
  section: { marginHorizontal: 12, marginTop: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  flagText: { fontSize: 12, fontWeight: "600" },
  remarks: { fontSize: 13, color: "#374151", lineHeight: 20 },
  linkBtn: { marginHorizontal: 12, marginTop: 16, backgroundColor: "#111", borderRadius: 10, padding: 14, alignItems: "center" },
  linkBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});

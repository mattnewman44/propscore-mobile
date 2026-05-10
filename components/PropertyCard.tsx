import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";

const GRADE_COLORS = {
  high:   { dot: "#dc2626", bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", label: "High" },
  medium: { dot: "#d97706", bg: "#fffbeb", border: "#fcd34d", text: "#92400e", label: "Med" },
  low:    { dot: "#16a34a", bg: "#f0fdf4", border: "#86efac", text: "#15803d", label: "Low" },
};

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export default function PropertyCard({ property, onPress }: { property: any; onPress: () => void }) {
  const g = GRADE_COLORS[property.grade as keyof typeof GRADE_COLORS] || GRADE_COLORS.low;
  const cutPct = property.priceHistory?.length > 1
    ? Math.round((property.priceHistory[0].price - property.price) / property.priceHistory[0].price * 100)
    : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {property.photo_url ? (
        <Image source={{ uri: property.photo_url }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.photoPlaceholderText}>🏠</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.price}>{fmtPrice(property.price)}</Text>
          <View style={[styles.scoreBadge, { backgroundColor: g.bg, borderColor: g.border }]}>
            <View style={[styles.scoreDot, { backgroundColor: g.dot }]} />
            <Text style={[styles.scoreText, { color: g.text }]}>{property.score}</Text>
          </View>
        </View>

        <Text style={styles.address} numberOfLines={1}>{property.address}</Text>
        <Text style={styles.cityState}>{property.city}{property.city && property.state ? ", " : ""}{property.state}</Text>

        <View style={styles.metaRow}>
          {property.bedrooms > 0 && <Text style={styles.meta}>{property.bedrooms}bd · {property.bathrooms}ba</Text>}
          {property.sqft && <Text style={styles.meta}>{property.sqft.toLocaleString()} sqft</Text>}
          {property.dom > 0 && <Text style={styles.meta}>{property.dom}d on mkt</Text>}
          {cutPct > 0 && <Text style={[styles.meta, { color: g.dot }]}>-{cutPct}% cut</Text>}
        </View>

        {property.financingFlags?.length > 0 && (
          <View style={styles.flags}>
            {property.financingFlags.slice(0, 3).map((f: any) => (
              <View key={f.key} style={[styles.flag, { backgroundColor: f.bg }]}>
                <Text style={[styles.flagText, { color: f.color }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  photo: { width: 100, height: 110 },
  photoPlaceholder: { backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  photoPlaceholderText: { fontSize: 28 },
  body: { flex: 1, padding: 10, justifyContent: "space-between" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { fontSize: 17, fontWeight: "700", color: "#111" },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  scoreDot: { width: 6, height: 6, borderRadius: 3 },
  scoreText: { fontSize: 13, fontWeight: "700" },
  address: { fontSize: 13, color: "#374151", marginTop: 2 },
  cityState: { fontSize: 12, color: "#6b7280" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  meta: { fontSize: 11, color: "#6b7280" },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  flag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  flagText: { fontSize: 10, fontWeight: "600" },
});

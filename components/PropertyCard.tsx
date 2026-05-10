import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";

const GRADE_COLORS = {
  high:   { dot: "#dc2626", bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
  medium: { dot: "#d97706", bg: "#fffbeb", border: "#fcd34d", text: "#92400e" },
  low:    { dot: "#16a34a", bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
};

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

interface Props {
  property: any;
  onPress: () => void;
  saved?: boolean;
  onToggleSaved?: () => void;
}

export default function PropertyCard({ property, onPress, saved = false, onToggleSaved }: Props) {
  const g = GRADE_COLORS[property.grade as keyof typeof GRADE_COLORS] || GRADE_COLORS.low;

  const ph = property.priceHistory || [];
  const origPrice = ph.length > 1 ? Math.max(...ph.map((h: any) => h.price)) : 0;
  const cutPct = origPrice > property.price
    ? Math.round((origPrice - property.price) / origPrice * 100)
    : 0;
  const cuts = (ph.length || 1) - 1;

  const domStyle = property.dom < 30
    ? { backgroundColor: "#f0fdf4", color: "#15803d" }
    : property.dom <= 60
    ? { backgroundColor: "#fffbeb", color: "#92400e" }
    : { backgroundColor: "#fef2f2", color: "#991b1b" };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {property.photo_url ? (
        <Image source={{ uri: property.photo_url }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.photoPlaceholderText}>🏠</Text>
        </View>
      )}

      <View style={styles.body}>
        {/* Top row: price + score + heart */}
        <View style={styles.topRow}>
          <Text style={styles.price}>{fmtPrice(property.price)}</Text>
          <View style={styles.topRight}>
            <View style={[styles.scoreBadge, { backgroundColor: g.bg, borderColor: g.border }]}>
              <View style={[styles.scoreDot, { backgroundColor: g.dot }]} />
              <Text style={[styles.scoreText, { color: g.text }]}>{property.score}</Text>
            </View>
            {onToggleSaved && (
              <TouchableOpacity onPress={onToggleSaved} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.heart}>{saved ? "❤️" : "🤍"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.address} numberOfLines={1}>{property.address}</Text>
        <Text style={styles.cityState}>{property.city}{property.city && property.state ? ", " : ""}{property.state}</Text>

        {/* Meta pills */}
        <View style={styles.metaRow}>
          {property.bedrooms > 0 && (
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>
                {property.bedrooms}bd · {property.bathrooms}ba
                {property.sqft ? ` · ${property.sqft >= 1000 ? `${(property.sqft / 1000).toFixed(1)}k` : property.sqft} sqft` : ""}
              </Text>
            </View>
          )}
          {property.dom > 0 && (
            <View style={[styles.metaPill, { backgroundColor: domStyle.backgroundColor }]}>
              <Text style={[styles.metaText, { color: domStyle.color, fontWeight: "500" }]}>{property.dom}d</Text>
            </View>
          )}
          {cuts > 0 && cutPct > 0 && (
            <View style={[styles.metaPill, { backgroundColor: "#fef2f2" }]}>
              <Text style={[styles.metaText, { color: "#991b1b" }]}>{cuts} cut{cuts > 1 ? "s" : ""} (-{cutPct}%)</Text>
            </View>
          )}
        </View>

        {/* Opportunity type badge */}
        {property.opportunityType && (
          <View style={styles.oppRow}>
            <View style={[styles.oppBadge, { backgroundColor: property.opportunityType.bg, borderColor: property.opportunityType.border }]}>
              <Text style={[styles.oppText, { color: property.opportunityType.color }]}>
                {property.opportunityType.icon} {property.opportunityType.label}
              </Text>
            </View>
          </View>
        )}

        {/* Financing flags */}
        {property.financingFlags?.length > 0 && (
          <View style={styles.flags}>
            {property.financingFlags.slice(0, 2).map((f: any) => (
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
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, marginHorizontal: 12, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, overflow: "hidden" },
  photo: { width: 100, height: 130 },
  photoPlaceholder: { backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  photoPlaceholderText: { fontSize: 28 },
  body: { flex: 1, padding: 10 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  price: { fontSize: 17, fontWeight: "700", color: "#111" },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  scoreDot: { width: 6, height: 6, borderRadius: 3 },
  scoreText: { fontSize: 13, fontWeight: "700" },
  heart: { fontSize: 16 },
  address: { fontSize: 13, color: "#374151" },
  cityState: { fontSize: 12, color: "#6b7280", marginBottom: 5 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 4 },
  metaPill: { backgroundColor: "#f3f4f6", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  metaText: { fontSize: 11, color: "#6b7280" },
  oppRow: { marginBottom: 4 },
  oppBadge: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  oppText: { fontSize: 11, fontWeight: "600" },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  flag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  flagText: { fontSize: 10, fontWeight: "600" },
});

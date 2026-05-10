import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, ActivityIndicator, TouchableOpacity } from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import DetailSheet from "../../components/DetailSheet";
import { fetchListings } from "../../lib/data";

const GRADE_COLORS = {
  high:   "#dc2626",
  medium: "#d97706",
  low:    "#16a34a",
};

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export default function MapScreen() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchListings()
      .then(setListings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visible = listings.filter(p => !gradeFilter || p.grade === gradeFilter);

  const GRADE_BTNS = [
    { key: "high",   color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", label: "High" },
    { key: "medium", color: "#d97706", bg: "#fffbeb", border: "#fcd34d", label: "Med" },
    { key: "low",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac", label: "Low" },
  ];

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading listings…</Text>
        </View>
      ) : (
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            latitude: 26.5629,
            longitude: -81.9495,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}
          showsUserLocation
          showsCompass={false}
        >
          {visible.map(p => (
            <Marker
              key={String(p.id)}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              onPress={() => setSelected(p)}
            >
              <View style={[styles.pin, { backgroundColor: GRADE_COLORS[p.grade as keyof typeof GRADE_COLORS] || "#6b7280" }]}>
                <Text style={styles.pinText}>{p.score}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Grade filters overlay */}
      <SafeAreaView style={styles.filterOverlay} edges={["top"]}>
        <View style={styles.filterRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{visible.length.toLocaleString()} listings</Text>
          </View>
          <View style={styles.gradeFilters}>
            {GRADE_BTNS.map(g => (
              <TouchableOpacity
                key={g.key}
                style={[styles.gradeBtn, { borderColor: g.border, backgroundColor: gradeFilter === g.key ? g.bg : "#fff" }]}
                onPress={() => setGradeFilter(gradeFilter === g.key ? null : g.key)}
              >
                <View style={[styles.dot, { backgroundColor: g.color }]} />
                <Text style={[styles.gradeBtnText, gradeFilter === g.key && { color: g.color }]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <DetailSheet property={selected} onClose={() => setSelected(null)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#6b7280" },
  pin: { borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, minWidth: 28, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },
  pinText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  filterOverlay: { position: "absolute", top: 0, left: 0, right: 0 },
  filterRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8, flexWrap: "wrap" },
  pill: { backgroundColor: "#111", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  gradeFilters: { flexDirection: "row", gap: 6 },
  gradeBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  gradeBtnText: { fontSize: 12, color: "#374151", fontWeight: "500" },
});

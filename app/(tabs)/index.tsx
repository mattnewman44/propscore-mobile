import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Modal, ActivityIndicator, StatusBar,
} from "react-native";
import PropertyCard from "../../components/PropertyCard";
import DetailSheet from "../../components/DetailSheet";
import FilterPanel from "../../components/FilterPanel";
import AddressSearch from "../../components/AddressSearch";
import { fetchListings, searchByAddress } from "../../lib/data";

const DEFAULT_FILTERS = { priceMin: 0, priceMax: 2_000_000, scoreMin: 0, scoreMax: 100, bedsMin: 0 };

export default function HomeScreen() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"score" | "price" | "dom">("score");
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchListings()
      .then(data => setListings(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = useCallback(async (address: string) => {
    setSearchLoading(true);
    try {
      const result = await searchByAddress(address);
      if (result) setSelected(result);
      else alert("Property not found. Try a full address like '1505 SE 36th St, Cape Coral, FL'");
    } catch {
      alert("Search failed. Check your connection and try again.");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const filtersActive =
    filters.priceMin > 0 || filters.priceMax < 2_000_000 ||
    filters.scoreMin > 0 || filters.scoreMax < 100 ||
    filters.bedsMin > 0;

  const sorted = [...listings]
    .filter(p => {
      if (gradeFilter && p.grade !== gradeFilter) return false;
      if (p.price < filters.priceMin || p.price > filters.priceMax) return false;
      if (p.score < filters.scoreMin || p.score > filters.scoreMax) return false;
      if (filters.bedsMin > 0 && p.bedrooms < filters.bedsMin) return false;
      return true;
    })
    .sort((a, b) =>
      sortBy === "score" ? b.score - a.score :
      sortBy === "price" ? a.price - b.price :
      b.dom - a.dom
    );

  const GRADE_BTNS = [
    { key: "high",   label: "High",   color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
    { key: "medium", label: "Med",    color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
    { key: "low",    label: "Low",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={{ fontWeight: "400" }}>Prop</Text>
          <Text style={{ fontWeight: "800" }}>Score</Text>
        </Text>
        {!loading && <Text style={styles.count}>{sorted.length.toLocaleString()} listings</Text>}
      </View>

      {/* Search with autocomplete */}
      <AddressSearch onSearch={handleSearch} loading={searchLoading} />

      {/* Filters + sort row */}
      <View style={styles.filterRow}>
        <View style={styles.leftFilters}>
          <TouchableOpacity
            style={[styles.filterBtn, filtersActive && styles.filterBtnActive]}
            onPress={() => setShowFilters(true)}
          >
            <Text style={[styles.filterBtnText, filtersActive && styles.filterBtnTextActive]}>
              {filtersActive ? "Filters ●" : "Filters"}
            </Text>
          </TouchableOpacity>

          {GRADE_BTNS.map(g => (
            <TouchableOpacity
              key={g.key}
              style={[styles.gradeBtn, { borderColor: g.border }, gradeFilter === g.key && { backgroundColor: g.bg }]}
              onPress={() => setGradeFilter(gradeFilter === g.key ? null : g.key)}
            >
              <View style={[styles.gradeDot, { backgroundColor: g.color }]} />
              <Text style={[styles.gradeBtnText, gradeFilter === g.key && { color: g.color }]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sortBtns}>
          {(["score", "price", "dom"] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]}
              onPress={() => setSortBy(s)}
            >
              <Text style={[styles.sortBtnText, sortBy === s && styles.sortBtnTextActive]}>
                {s === "score" ? "Score" : s === "price" ? "Price" : "DOM"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading listings…</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <PropertyCard property={item} onPress={() => setSelected(item)} />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No listings match your filters</Text>
              <TouchableOpacity onPress={() => { setFilters(DEFAULT_FILTERS); setGradeFilter(null); }}>
                <Text style={styles.clearText}>Clear filters</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <DetailSheet property={selected} onClose={() => setSelected(null)} />
      </Modal>

      {/* Filter panel */}
      <FilterPanel
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        values={filters}
        onApply={setFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  logo: { fontSize: 22, color: "#111" },
  count: { fontSize: 13, color: "#6b7280" },
  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8, flexWrap: "wrap", gap: 6 },
  leftFilters: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" },
  filterBtn: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#fff" },
  filterBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  filterBtnText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  filterBtnTextActive: { color: "#fff", fontWeight: "600" },
  gradeBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#fff" },
  gradeDot: { width: 6, height: 6, borderRadius: 3 },
  gradeBtnText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  sortBtns: { flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 8, padding: 2 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  sortBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  sortBtnText: { fontSize: 12, color: "#6b7280" },
  sortBtnTextActive: { color: "#111", fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 14, color: "#6b7280" },
  emptyText: { fontSize: 15, color: "#374151" },
  clearText: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
});

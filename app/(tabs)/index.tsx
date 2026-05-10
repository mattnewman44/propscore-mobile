import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Modal, ActivityIndicator, StatusBar,
} from "react-native";
import PropertyCard from "../../components/PropertyCard";
import DetailSheet from "../../components/DetailSheet";
import FilterPanel, { FilterValues } from "../../components/FilterPanel";
import AddressSearch from "../../components/AddressSearch";
import MarketStatsBar from "../../components/MarketStatsBar";
import PropScoreLogo from "../../components/PropScoreLogo";
import { searchByAddress, enrichByAddress } from "../../lib/data";
import { useListings } from "../../lib/ListingsContext";

const DEFAULT_FILTERS: FilterValues = {
  priceMin: 0, priceMax: 2_000_000,
  scoreMin: 0, scoreMax: 100,
  bedsMin: 0, bathsMin: 0,
  showDistressedOnly: false,
  showSavedOnly: false,
  showEnrichedOnly: false,
};

const SALE_TYPE_OPTIONS = [
  { key: "foreclosure", label: "🏦 Foreclosure / REO" },
  { key: "shortSale",   label: "⏳ Short sale" },
  { key: "probate",     label: "⚖️ Probate / estate" },
  { key: "asIs",        label: "🔧 As-is / fixer" },
  { key: "cashOnly",    label: "💵 Cash only" },
];

const GRADE_BTNS = [
  { key: "high",   label: "High",   color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
  { key: "medium", label: "Med",    color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  { key: "low",    label: "Low",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
];

export default function HomeScreen() {
  const { listings, loading, savedHomes, toggleSaved, updateListing, marketStats } = useListings();

  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected]           = useState<any>(null);
  const [sortBy, setSortBy]               = useState<"score" | "price" | "dom">("score");
  const [sortDir, setSortDir]             = useState<"desc" | "asc">("desc");
  const [gradeFilter, setGradeFilter]     = useState<string | null>(null);
  const [filters, setFilters]             = useState<FilterValues>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters]     = useState(false);
  const [saleTypeFilter, setSaleTypeFilter] = useState<string | null>(null);
  const [listLimit, setListLimit]         = useState(50);

  const handleSearch = useCallback(async (address: string) => {
    setSearchLoading(true);
    try {
      const result = await searchByAddress(address);
      if (result) {
        setSelected(result);
        // Stale-while-revalidate: if from Supabase cache, enrich in background
        if (result._searchSource === "database") {
          enrichByAddress(result).then(fields => {
            if (!fields) return;
            setSelected(prev => {
              if (!prev || String(prev.id) !== String(result.id)) return prev;
              return { ...prev, ...fields };
            });
            updateListing(String(result.id), fields);
          });
        }
      } else {
        alert("Property not found. Try a full address like '1505 SE 36th St, Cape Coral, FL'");
      }
    } catch {
      alert("Search failed. Check your connection and try again.");
    } finally {
      setSearchLoading(false);
    }
  }, [updateListing]);

  const toggleSort = (col: "score" | "price" | "dom") => {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const filtersActive =
    filters.priceMin > 0 || filters.priceMax < 2_000_000 ||
    filters.scoreMin > 0 || filters.scoreMax < 100 ||
    filters.bedsMin > 0 || filters.bathsMin > 0 ||
    filters.showDistressedOnly || filters.showSavedOnly || filters.showEnrichedOnly ||
    !!saleTypeFilter;

  const sorted = [...listings]
    .filter(p => {
      if (gradeFilter && p.grade !== gradeFilter) return false;
      if (filters.showDistressedOnly && p.grade === "low") return false;
      if (p.price < filters.priceMin || p.price > filters.priceMax) return false;
      if (p.score < filters.scoreMin || p.score > filters.scoreMax) return false;
      if (filters.bedsMin > 0 && p.bedrooms < filters.bedsMin) return false;
      if (filters.bathsMin > 0 && p.bathrooms < filters.bathsMin) return false;
      if (filters.showSavedOnly && !savedHomes.has(String(p.id))) return false;
      if (filters.showEnrichedOnly && !p.enriched) return false;
      if (saleTypeFilter && !p.financingFlags?.some((f: any) => f.key === saleTypeFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      const mult = sortDir === "desc" ? -1 : 1;
      if (sortBy === "score") return mult * (a.score - b.score);
      if (sortBy === "price") return mult * (a.price - b.price);
      return mult * (a.dom - b.dom);
    });

  const anyActive = filtersActive || !!gradeFilter;

  const clearAll = () => {
    setGradeFilter(null);
    setFilters(DEFAULT_FILTERS);
    setSaleTypeFilter(null);
    setSortBy("score");
    setSortDir("desc");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <PropScoreLogo />
        {!loading && <Text style={styles.count}>{sorted.length.toLocaleString()} listings</Text>}
      </View>

      {/* Search */}
      <AddressSearch onSearch={handleSearch} loading={searchLoading} />

      {/* Filter pills */}
      <View style={styles.pillRow}>
        <TouchableOpacity
          style={[styles.pill, filtersActive && styles.pillActive]}
          onPress={() => setShowFilters(true)}
        >
          <Text style={[styles.pillText, filtersActive && styles.pillTextActive]}>
            Filters{filtersActive ? " ●" : " ▾"}
          </Text>
        </TouchableOpacity>

        {GRADE_BTNS.map(g => (
          <TouchableOpacity
            key={g.key}
            style={[styles.pill, { borderColor: g.border }, gradeFilter === g.key && { backgroundColor: g.bg }]}
            onPress={() => setGradeFilter(gradeFilter === g.key ? null : g.key)}
          >
            <View style={[styles.gradeDot, { backgroundColor: g.color }]} />
            <Text style={[styles.pillText, gradeFilter === g.key && { color: g.color, fontWeight: "600" }]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sort row */}
      <View style={styles.sortRow}>
        <View style={styles.sortBtns}>
          {(["score", "price", "dom"] as const).map(s => (
            <TouchableOpacity key={s} style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]} onPress={() => toggleSort(s)}>
              <Text style={[styles.sortBtnText, sortBy === s && styles.sortBtnTextActive]}>
                {s === "score" ? "Score" : s === "price" ? "Price" : "DOM"}
                {sortBy === s ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {anyActive && (
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clearText}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Distress color key legend */}
      <View style={styles.legendRow}>
        {GRADE_BTNS.map(g => (
          <View key={g.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: g.color }]} />
            <Text style={styles.legendText}>{g.label}</Text>
          </View>
        ))}
        <Text style={styles.legendHint}>Distress signals</Text>
      </View>

      {/* Market stats */}
      {!loading && <MarketStatsBar stats={marketStats} />}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading listings…</Text>
        </View>
      ) : (
        <FlatList
          data={sorted.slice(0, listLimit)}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              onPress={() => setSelected(item)}
              saved={savedHomes.has(String(item.id))}
              onToggleSaved={() => toggleSaved(String(item.id))}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            sorted.length > listLimit ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setListLimit(l => l + 50)}>
                <Text style={styles.loadMoreText}>
                  Show {Math.min(50, sorted.length - listLimit)} more · {sorted.length - listLimit} remaining
                </Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No listings match your filters</Text>
              <TouchableOpacity onPress={clearAll}>
                <Text style={styles.clearLink}>Clear filters</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <DetailSheet
          property={selected}
          onClose={() => setSelected(null)}
          saved={selected ? savedHomes.has(String(selected.id)) : false}
          onToggleSaved={() => selected && toggleSaved(String(selected.id))}
        />
      </Modal>

      {/* Filter panel */}
      <FilterPanel
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        values={filters}
        onApply={setFilters}
        saleTypeFilter={saleTypeFilter}
        onSaleTypeFilter={setSaleTypeFilter}
        saleTypeOptions={SALE_TYPE_OPTIONS}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  count: { fontSize: 13, color: "#6b7280" },
  pillRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 6, gap: 6, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  pillActive: { backgroundColor: "#111", borderColor: "#111" },
  pillText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  pillTextActive: { color: "#fff", fontWeight: "600" },
  gradeDot: { width: 6, height: 6, borderRadius: 3 },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 6 },
  sortBtns: { flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 8, padding: 2 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  sortBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  sortBtnText: { fontSize: 12, color: "#6b7280" },
  sortBtnTextActive: { color: "#111", fontWeight: "600" },
  clearText: { fontSize: 12, color: "#dc2626", fontWeight: "500" },
  legendRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 6, gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 11, color: "#6b7280" },
  legendHint: { flex: 1, textAlign: "right", fontSize: 10, color: "#9ca3af" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 14, color: "#6b7280" },
  emptyText: { fontSize: 15, color: "#374151" },
  clearLink: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
  loadMoreBtn: { marginHorizontal: 12, marginBottom: 16, padding: 14, backgroundColor: "#f3f4f6", borderRadius: 10, alignItems: "center" },
  loadMoreText: { fontSize: 13, color: "#374151" },
});

import "react-native-url-polyfill/auto";
import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, Image, Keyboard, ActivityIndicator,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import DetailSheet from "../../components/DetailSheet";
import FilterPanel, { FilterValues } from "../../components/FilterPanel";
import { useListings } from "../../lib/ListingsContext";
import { searchByAddress } from "../../lib/data";

const DEFAULT_FILTERS: FilterValues = {
  priceMin: 0, priceMax: 2_000_000,
  scoreMin: 0, scoreMax: 100,
  bedsMin: 0, bathsMin: 0,
  showDistressedOnly: false,
  showSavedOnly: false,
  showEnrichedOnly: false,
};

const GRADE_COLORS = {
  high:   "#dc2626",
  medium: "#d97706",
  low:    "#16a34a",
};

const GRADE_BTNS = [
  { key: "high",   color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", label: "High" },
  { key: "medium", color: "#d97706", bg: "#fffbeb", border: "#fcd34d", label: "Med" },
  { key: "low",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac", label: "Low" },
];

// Max pins to render at once — keeps touches responsive
const MAX_PINS = 400;

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export default function MapScreen() {
  const { listings, loading, savedHomes, toggleSaved } = useListings();

  const [gradeFilter, setGradeFilter]   = useState<string | null>(null);
  const [filters, setFilters]           = useState<FilterValues>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters]   = useState(false);
  const [sheet, setSheet]               = useState<any>(null);
  const [detail, setDetail]             = useState<any>(null);
  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters =
    filters.priceMin > 0 || filters.priceMax < 2_000_000 ||
    filters.scoreMin > 0 || filters.scoreMax < 100 ||
    filters.bedsMin > 0  || filters.bathsMin > 0 ||
    filters.showDistressedOnly || filters.showSavedOnly || filters.showEnrichedOnly;

  // Apply all filters
  const filtered = listings.filter(p => {
    if (gradeFilter && p.grade !== gradeFilter) return false;
    if (p.price < filters.priceMin || p.price > filters.priceMax) return false;
    if (p.score < filters.scoreMin || p.score > filters.scoreMax) return false;
    if (filters.bedsMin  > 0 && (p.bedrooms  || 0) < filters.bedsMin)  return false;
    if (filters.bathsMin > 0 && (p.bathrooms || 0) < filters.bathsMin) return false;
    if (filters.showDistressedOnly && p.grade === "low") return false;
    if (filters.showSavedOnly && !savedHomes.has(String(p.id))) return false;
    if (filters.showEnrichedOnly && !p.enriched) return false;
    return true;
  });

  // Cap at MAX_PINS sorted by score descending so highest-score pins always show
  const visible = filtered
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PINS);

  const isCapped = filtered.length > MAX_PINS;

  // Mapbox autocomplete
  const fetchSuggestions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?country=US&types=address&limit=4&access_token=${token}`
        );
        const json = await res.json();
        setSuggestions(json.features || []);
      } catch { setSuggestions([]); }
    }, 300);
  }, []);

  const handleSuggestionSelect = useCallback(async (feature: any) => {
    setQuery(feature.place_name);
    setSuggestions([]);
    Keyboard.dismiss();
    setSearchLoading(true);
    try {
      const result = await searchByAddress(feature.place_name);
      if (result) setSheet(result);
    } catch {}
    finally { setSearchLoading(false); }
  }, []);

  const domStyle = (dom: number) =>
    dom < 30  ? { bg: "#f0fdf4", color: "#15803d" } :
    dom <= 60 ? { bg: "#fffbeb", color: "#92400e" } :
                { bg: "#fef2f2", color: "#991b1b" };

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
              tracksViewChanges={false}
              onPress={() => { setSheet(p); setSuggestions([]); }}
            >
              <View style={[styles.pin, { backgroundColor: GRADE_COLORS[p.grade as keyof typeof GRADE_COLORS] || "#6b7280" }]}>
                <Text style={styles.pinText}>{p.score}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* ── Floating top bar ── */}
      <SafeAreaView style={styles.topOverlay} edges={["top"]} pointerEvents="box-none">
        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={t => { setQuery(t); fetchSuggestions(t); }}
              placeholder="Search address…"
              placeholderTextColor="#9ca3af"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchLoading
              ? <ActivityIndicator size="small" color="#2563eb" style={styles.searchIcon} />
              : <Text style={styles.searchIcon}>🔍</Text>
            }
          </View>
        </View>

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <View style={styles.dropdown}>
            {suggestions.map(f => (
              <TouchableOpacity key={f.id} style={styles.dropdownItem} onPress={() => handleSuggestionSelect(f)}>
                <Text style={styles.dropdownText} numberOfLines={1}>{f.place_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Filter row: count + grade pills + Filters button */}
        <View style={styles.filterRow}>
          <View style={styles.countPill}>
            <Text style={styles.countText}>
              {isCapped ? `Top ${MAX_PINS} of ${filtered.length.toLocaleString()}` : `${filtered.length.toLocaleString()} listings`}
            </Text>
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
          <TouchableOpacity
            style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(true)}
          >
            <Text style={[styles.filterBtnText, hasActiveFilters && styles.filterBtnTextActive]}>
              {hasActiveFilters ? "⚙ Filters •" : "⚙ Filters"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Bottom peek sheet on pin tap ── */}
      {sheet && (
        <>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setSheet(null)} activeOpacity={1} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {sheet.photo_url && (
              <Image source={{ uri: sheet.photo_url }} style={styles.sheetPhoto} resizeMode="cover" />
            )}
            <View style={styles.sheetBody}>
              <View style={styles.sheetTopRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.sheetAddress} numberOfLines={1}>{sheet.address}</Text>
                  <Text style={styles.sheetCity}>{sheet.city}, {sheet.state} {sheet.zip}</Text>
                </View>
                <TouchableOpacity onPress={() => setSheet(null)}>
                  <Text style={styles.sheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sheetMidRow}>
                <Text style={styles.sheetPrice}>{fmtPrice(sheet.price)}</Text>
                {(() => {
                  const gc = sheet.grade === "high"
                    ? { bg:"#fef2f2", border:"#fca5a5", dot:"#dc2626", text:"#991b1b" }
                    : sheet.grade === "medium"
                    ? { bg:"#fffbeb", border:"#fcd34d", dot:"#d97706", text:"#92400e" }
                    : { bg:"#f0fdf4", border:"#86efac", dot:"#16a34a", text:"#15803d" };
                  return (
                    <View style={[styles.scoreBadge, { backgroundColor: gc.bg, borderColor: gc.border }]}>
                      <View style={[styles.scoreDot, { backgroundColor: gc.dot }]} />
                      <Text style={[styles.scoreText, { color: gc.text }]}>{sheet.score}</Text>
                    </View>
                  );
                })()}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                {sheet.bedrooms > 0 && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaText}>{sheet.bedrooms}bd · {sheet.bathrooms}ba{sheet.sqft ? ` · ${sheet.sqft.toLocaleString()} sqft` : ""}</Text>
                  </View>
                )}
                {sheet.dom > 0 && (() => {
                  const dc = domStyle(sheet.dom);
                  return (
                    <View style={[styles.metaPill, { backgroundColor: dc.bg }]}>
                      <Text style={[styles.metaText, { color: dc.color, fontWeight: "600" }]}>{sheet.dom}d on market</Text>
                    </View>
                  );
                })()}
                {sheet.pricecuts > 0 && sheet.totalCutPct > 0 && (
                  <View style={[styles.metaPill, { backgroundColor: "#fef2f2" }]}>
                    <Text style={[styles.metaText, { color: "#991b1b" }]}>{sheet.pricecuts} cut{sheet.pricecuts > 1 ? "s" : ""} (-{sheet.totalCutPct}%)</Text>
                  </View>
                )}
                {sheet.opportunityType && (
                  <View style={[styles.metaPill, { backgroundColor: sheet.opportunityType.bg, borderColor: sheet.opportunityType.border, borderWidth: 1 }]}>
                    <Text style={[styles.metaText, { color: sheet.opportunityType.color, fontWeight: "600" }]}>{sheet.opportunityType.icon} {sheet.opportunityType.label}</Text>
                  </View>
                )}
                {sheet.floodZone && (
                  <View style={[styles.metaPill, { backgroundColor: "#eff6ff" }]}>
                    <Text style={[styles.metaText, { color: "#1d4ed8", fontWeight: "600" }]}>🌊 {sheet.floodZone}</Text>
                  </View>
                )}
                {sheet.financingFlags?.slice(0, 2).map((f: any) => (
                  <View key={f.key} style={[styles.metaPill, { backgroundColor: f.bg }]}>
                    <Text style={[styles.metaText, { color: f.color, fontWeight: "600" }]}>{f.label}</Text>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.detailBtn} onPress={() => { setDetail(sheet); setSheet(null); }}>
                <Text style={styles.detailBtnText}>View full details →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Full detail modal */}
      <Modal visible={!!detail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetail(null)}>
        <DetailSheet
          property={detail}
          onClose={() => setDetail(null)}
          saved={detail ? savedHomes.has(String(detail.id)) : false}
          onToggleSaved={() => detail && toggleSaved(String(detail.id))}
        />
      </Modal>

      {/* Filter panel */}
      <FilterPanel
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        values={filters}
        onApply={v => setFilters(v)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#6b7280" },

  pin: { borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, minWidth: 28, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },
  pinText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 200 },
  searchRow: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 28, paddingHorizontal: 16, paddingVertical: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  searchInput: { flex: 1, fontSize: 14, color: "#111" },
  searchIcon: { marginLeft: 8, fontSize: 14 },
  dropdown: { marginHorizontal: 12, backgroundColor: "#fff", borderRadius: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4, overflow: "hidden" },
  dropdownItem: { padding: 12, borderBottomWidth: 0.5, borderColor: "#f0f0f0" },
  dropdownText: { fontSize: 13, color: "#374151" },

  filterRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8, gap: 6, flexWrap: "nowrap" },
  countPill: { backgroundColor: "#111", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  countText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  gradeFilters: { flexDirection: "row", gap: 5, flex: 1 },
  gradeBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: "#fff" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  gradeBtnText: { fontSize: 11, color: "#374151", fontWeight: "500" },
  filterBtn: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "#fff" },
  filterBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  filterBtnText: { fontSize: 11, color: "#374151", fontWeight: "600" },
  filterBtnTextActive: { color: "#fff" },

  sheetBackdrop: { position: "absolute", inset: 0, zIndex: 999 } as any,
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8, paddingBottom: 32 },
  sheetHandle: { width: 40, height: 4, backgroundColor: "#d1d5db", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 6 },
  sheetPhoto: { width: "100%", height: 140 },
  sheetBody: { padding: 14 },
  sheetTopRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  sheetAddress: { fontSize: 15, fontWeight: "700", color: "#111" },
  sheetCity: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  sheetClose: { fontSize: 18, color: "#9ca3af", padding: 2 },
  sheetMidRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sheetPrice: { fontSize: 20, fontWeight: "800", color: "#111" },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  scoreDot: { width: 6, height: 6, borderRadius: 3 },
  scoreText: { fontSize: 13, fontWeight: "700" },
  pillScroll: { marginBottom: 12 },
  metaPill: { backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6 },
  metaText: { fontSize: 12, color: "#374151" },
  detailBtn: { backgroundColor: "#111", borderRadius: 10, padding: 14, alignItems: "center" },
  detailBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

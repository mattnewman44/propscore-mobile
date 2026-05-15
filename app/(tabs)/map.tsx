import "react-native-url-polyfill/auto";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, Image, Keyboard, ActivityIndicator,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import DetailSheet from "../../components/DetailSheet";
import FilterPanel, { FilterValues } from "../../components/FilterPanel";
import WeightsModal from "../../components/WeightsModal";
import { useListings } from "../../lib/ListingsContext";
import { searchByAddress, fetchSoldComps, fetchOffMarketListings } from "../../lib/data";

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

const MAX_VIEWPORT_PINS = 300;

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function fmtDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Single-color circle marker: solid grade color with score number
function SplitCircleMarker({ score, grade }: { score: number; grade: string }) {
  const gradeColor = GRADE_COLORS[grade as keyof typeof GRADE_COLORS] || "#6b7280";
  const SIZE = 30;
  return (
    <View style={{
      width: SIZE, height: SIZE, borderRadius: SIZE / 2,
      backgroundColor: gradeColor,
      alignItems: "center", justifyContent: "center",
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3, shadowRadius: 2, elevation: 3,
    }}>
      <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>{score}</Text>
    </View>
  );
}

// Grey pill with sold price
function SoldMarker({ price }: { price: number }) {
  return (
    <View style={{
      backgroundColor: "#4b5563", borderRadius: 8,
      paddingHorizontal: 5, paddingVertical: 2,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
    }}>
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>{fmtPrice(price)}</Text>
    </View>
  );
}

// Hollow grey circle for off-market
function OffMarketMarker() {
  return (
    <View style={{
      width: 18, height: 18, borderRadius: 9,
      borderWidth: 2, borderColor: "#9ca3af",
      backgroundColor: "rgba(255,255,255,0.75)",
    }} />
  );
}

export default function MapScreen() {
  const { listings, loading, savedHomes, toggleSaved, hasCustomWeights } = useListings();

  const [gradeFilter, setGradeFilter]   = useState<string | null>(null);
  const [filters, setFilters]           = useState<FilterValues>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters]   = useState(false);
  const [showWeights, setShowWeights]   = useState(false);
  const [sheet, setSheet]               = useState<any>(null);
  const [detail, setDetail]             = useState<any>(null);
  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Sold + off-market layers
  const [showSold, setShowSold]               = useState(false);
  const [showOffMarket, setShowOffMarket]     = useState(false);
  const [soldComps, setSoldComps]             = useState<any[]>([]);
  const [offMarketListings, setOffMarket]     = useState<any[]>([]);
  const [soldLoading, setSoldLoading]         = useState(false);
  const [offMarketLoading, setOffMarketLoading] = useState(false);
  const [soldSheet, setSoldSheet]             = useState<any>(null);
  const [offSheet, setOffSheet]               = useState<any>(null);
  const [compHighlight, setCompHighlight]     = useState<any[] | null>(null);

  const [region, setRegion] = useState({
    latMin: 26.4729, latMax: 26.6529,
    lngMin: -82.0395, lngMax: -81.8595,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch sold comps when layer toggled on or region changes
  useEffect(() => {
    if (!showSold) { setSoldComps([]); return; }
    setSoldLoading(true);
    fetchSoldComps(region)
      .then(setSoldComps)
      .catch(() => {})
      .finally(() => setSoldLoading(false));
  }, [showSold, region]);

  // Fetch off-market when layer toggled on or region changes
  useEffect(() => {
    if (!showOffMarket) { setOffMarket([]); return; }
    setOffMarketLoading(true);
    fetchOffMarketListings(region)
      .then(setOffMarket)
      .catch(() => {})
      .finally(() => setOffMarketLoading(false));
  }, [showOffMarket, region]);

  const hasActiveFilters =
    filters.priceMin > 0 || filters.priceMax < 2_000_000 ||
    filters.scoreMin > 0 || filters.scoreMax < 100 ||
    filters.bedsMin > 0  || filters.bathsMin > 0 ||
    filters.showDistressedOnly || filters.showSavedOnly || filters.showEnrichedOnly;

  const filtered = listings.filter(p => {
    if (!p.lat || !p.lng) return false;
    if (p.lat < region.latMin || p.lat > region.latMax) return false;
    if (p.lng < region.lngMin || p.lng > region.lngMax) return false;
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

  const visible = filtered
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_VIEWPORT_PINS);

  const isCapped = filtered.length > MAX_VIEWPORT_PINS;

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
      const [lng, lat] = feature.center || [];
      const result = await searchByAddress(feature.place_name, lat, lng);
      if (result) setSheet(result);
    } catch {}
    finally { setSearchLoading(false); }
  }, []);

  const domStyle = (dom: number) =>
    dom < 30  ? { bg: "#f0fdf4", color: "#15803d" } :
    dom <= 60 ? { bg: "#fffbeb", color: "#92400e" } :
                { bg: "#fef2f2", color: "#991b1b" };

  const closeAllSheets = () => { setSheet(null); setSoldSheet(null); setOffSheet(null); };

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
          onRegionChangeComplete={r => {
            setRegion({
              latMin: r.latitude  - r.latitudeDelta  * 0.6,
              latMax: r.latitude  + r.latitudeDelta  * 0.6,
              lngMin: r.longitude - r.longitudeDelta * 0.6,
              lngMax: r.longitude + r.longitudeDelta * 0.6,
            });
          }}
        >
          {/* Comp highlight pins (shown when user taps "View on Map" from comps accordion) */}
          {compHighlight && compHighlight.map((c, i) => (
            <Marker
              key={`ch-${i}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              tracksViewChanges={false}
            >
              <View style={{ backgroundColor: "#2563eb", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 2, borderColor: "#fff" }}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{fmtPrice(c.sold_price)}</Text>
              </View>
            </Marker>
          ))}

          {/* Active listing pins — dimmed in comp highlight mode */}
          {!compHighlight && visible.map(p => (
            <Marker
              key={String(p.id)}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              tracksViewChanges={false}
              onPress={() => { closeAllSheets(); setSheet(p); setSuggestions([]); }}
            >
              <SplitCircleMarker score={p.score} grade={p.grade} />
            </Marker>
          ))}

          {/* Sold comp pins */}

          {showSold && soldComps.map(c => (
            <Marker
              key={`sold-${c.id}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              tracksViewChanges={false}
              onPress={() => { closeAllSheets(); setSoldSheet(c); }}
            >
              <SoldMarker price={c.sold_price} />
            </Marker>
          ))}

          {/* Off-market pins */}
          {showOffMarket && offMarketListings.map(p => (
            <Marker
              key={`off-${p.id}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              tracksViewChanges={false}
              onPress={() => { closeAllSheets(); setOffSheet(p); }}
            >
              <OffMarketMarker />
            </Marker>
          ))}
        </MapView>
      )}

      {/* ── Floating top bar ── */}
      <SafeAreaView style={styles.topOverlay} edges={["top"]} pointerEvents="box-none">
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

        {suggestions.length > 0 && (
          <View style={styles.dropdown}>
            {suggestions.map(f => (
              <TouchableOpacity key={f.id} style={styles.dropdownItem} onPress={() => handleSuggestionSelect(f)}>
                <Text style={styles.dropdownText} numberOfLines={1}>{f.place_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.filterRow}>
          <View style={styles.countPill}>
            <Text style={styles.countText}>
              {isCapped ? `Top ${MAX_VIEWPORT_PINS} of ${filtered.length.toLocaleString()}` : `${filtered.length.toLocaleString()} listings`}
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
          <TouchableOpacity
            style={[styles.filterBtn, hasCustomWeights && { backgroundColor: "#f0f9ff", borderColor: "#bae6fd" }]}
            onPress={() => setShowWeights(true)}
          >
            <Text style={[styles.filterBtnText, hasCustomWeights && { color: "#0369a1", fontWeight: "600" }]}>
              {hasCustomWeights ? "⚖ •" : "⚖"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Layer toggles (left side) ── */}
      <View style={styles.layerToggles} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.layerBtn, showSold && styles.layerBtnActive]}
          onPress={() => setShowSold(v => !v)}
        >
          {soldLoading
            ? <ActivityIndicator size="small" color={showSold ? "#fff" : "#4b5563"} />
            : <Text style={[styles.layerBtnText, showSold && styles.layerBtnTextActive]}>Sold</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.layerBtn, showOffMarket && styles.layerBtnActive]}
          onPress={() => setShowOffMarket(v => !v)}
        >
          {offMarketLoading
            ? <ActivityIndicator size="small" color={showOffMarket ? "#fff" : "#4b5563"} />
            : <Text style={[styles.layerBtnText, showOffMarket && styles.layerBtnTextActive]}>Off-Mkt</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Active listing peek sheet ── */}
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

      {/* ── Sold comp peek sheet ── */}
      {soldSheet && (
        <>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setSoldSheet(null)} activeOpacity={1} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetBody}>
              <View style={styles.sheetTopRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={[styles.metaPill, { backgroundColor: "#f3f4f6", alignSelf: "flex-start", marginBottom: 4 }]}>
                    <Text style={[styles.metaText, { color: "#6b7280", fontWeight: "600" }]}>SOLD COMP</Text>
                  </View>
                  <Text style={styles.sheetAddress} numberOfLines={1}>{soldSheet.address}</Text>
                  <Text style={styles.sheetCity}>{soldSheet.city}, {soldSheet.state}</Text>
                </View>
                <TouchableOpacity onPress={() => setSoldSheet(null)}>
                  <Text style={styles.sheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sheetMidRow}>
                <Text style={styles.sheetPrice}>{fmtPrice(soldSheet.sold_price)}</Text>
                {soldSheet.sold_date && (
                  <View style={[styles.metaPill, { backgroundColor: "#f3f4f6" }]}>
                    <Text style={[styles.metaText, { color: "#6b7280" }]}>Sold {fmtDate(soldSheet.sold_date)}</Text>
                  </View>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                {(soldSheet.bedrooms > 0 || soldSheet.bathrooms > 0) && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaText}>
                      {soldSheet.bedrooms}bd · {soldSheet.bathrooms}ba
                      {soldSheet.sqft ? ` · ${soldSheet.sqft.toLocaleString()} sqft` : ""}
                    </Text>
                  </View>
                )}
                {soldSheet.prop_type && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaText}>{soldSheet.prop_type}</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </>
      )}

      {/* ── Off-market peek sheet ── */}
      {offSheet && (
        <>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setOffSheet(null)} activeOpacity={1} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetBody}>
              <View style={styles.sheetTopRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={[styles.metaPill, { backgroundColor: "#f3f4f6", alignSelf: "flex-start", marginBottom: 4 }]}>
                    <Text style={[styles.metaText, { color: "#6b7280", fontWeight: "600" }]}>OFF-MARKET</Text>
                  </View>
                  <Text style={styles.sheetAddress} numberOfLines={1}>{offSheet.address}</Text>
                  <Text style={styles.sheetCity}>{offSheet.city}, {offSheet.state}</Text>
                </View>
                <TouchableOpacity onPress={() => setOffSheet(null)}>
                  <Text style={styles.sheetClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sheetMidRow}>
                {offSheet.price > 0 && <Text style={styles.sheetPrice}>{fmtPrice(offSheet.price)}</Text>}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                {(offSheet.bedrooms > 0 || offSheet.bathrooms > 0) && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaText}>
                      {offSheet.bedrooms}bd · {offSheet.bathrooms}ba
                      {offSheet.sqft ? ` · ${offSheet.sqft.toLocaleString()} sqft` : ""}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </>
      )}

      {/* Comp highlight banner */}
      {compHighlight && (
        <View style={styles.compBanner}>
          <Text style={styles.compBannerText}>Showing {compHighlight.length} sold comps</Text>
          <TouchableOpacity onPress={() => setCompHighlight(null)} style={styles.compBannerClear}>
            <Text style={styles.compBannerClearText}>✕ Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full detail modal */}
      <Modal visible={!!detail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetail(null)}>
        <DetailSheet
          property={detail}
          onClose={() => setDetail(null)}
          saved={detail ? savedHomes.has(String(detail.id)) : false}
          onToggleSaved={() => detail && toggleSaved(String(detail.id))}
          onViewCompsOnMap={comps => { setDetail(null); setCompHighlight(comps); }}
        />
      </Modal>

      <FilterPanel
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        values={filters}
        onApply={v => setFilters(v)}
      />

      <WeightsModal visible={showWeights} onClose={() => setShowWeights(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#6b7280" },

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

  // Layer toggle buttons (left side, midway down)
  layerToggles: { position: "absolute", left: 12, top: "45%", zIndex: 100, gap: 6 } as any,
  layerBtn: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3, minWidth: 64, alignItems: "center" },
  layerBtnActive: { backgroundColor: "#4b5563", borderColor: "#4b5563" },
  layerBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  layerBtnTextActive: { color: "#fff" },

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

  compBanner: { position: "absolute", bottom: 32, left: 16, right: 16, zIndex: 900, backgroundColor: "#1e40af", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  compBannerText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  compBannerClear: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  compBannerClearText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});

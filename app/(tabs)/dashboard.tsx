import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Modal, ActivityIndicator,
} from "react-native";
import DetailSheet from "../../components/DetailSheet";
import { useListings } from "../../lib/ListingsContext";

const GRADE_CONFIG = {
  high:   { label: "High",   color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
  medium: { label: "Med",    color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  low:    { label: "Low",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
};

const FINANCING_ICONS: Record<string, string> = {
  cashOnly:    "💵",
  foreclosure: "🏦",
  shortSale:   "⏳",
  probate:     "⚖️",
  asIs:        "🔧",
};

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const s = (sentiment || "").toLowerCase();
  const cfg =
    s === "negative" ? { bg: "#fef2f2", border: "#fca5a5", color: "#991b1b", label: "Negative" } :
    s === "positive" ? { bg: "#f0fdf4", border: "#86efac", color: "#15803d", label: "Positive" } :
                       { bg: "#f3f4f6", border: "#d1d5db", color: "#6b7280", label: "Neutral" };
  return (
    <View style={[sb.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[sb.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  text:  { fontSize: 10, fontWeight: "700" },
});

export default function DashboardScreen() {
  const { listings, loading, news, savedHomes, toggleSaved } = useListings();
  const [detail, setDetail] = useState<any>(null);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const highCount   = listings.filter(p => p.grade === "high").length;
  const mediumCount = listings.filter(p => p.grade === "medium").length;
  const lowCount    = listings.filter(p => p.grade === "low").length;
  const total       = listings.length || 1;

  const top5 = listings
    .filter(p => p.lat && p.lng)
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Count financing flags across all listings
  const flagCounts: Record<string, number> = {};
  for (const p of listings) {
    for (const f of p.financingFlags || []) {
      flagCounts[f.key] = (flagCounts[f.key] || 0) + 1;
    }
  }
  const flagEntries = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const recentNews = (news || []).slice(0, 8);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Dashboard</Text>

        {/* ── Distress Distribution ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Distress Distribution</Text>
          <Text style={styles.cardSub}>{total.toLocaleString()} total listings</Text>

          {(["high", "medium", "low"] as const).map(grade => {
            const count = grade === "high" ? highCount : grade === "medium" ? mediumCount : lowCount;
            const pct   = Math.round((count / total) * 100);
            const cfg   = GRADE_CONFIG[grade];
            return (
              <View key={grade} style={styles.distRow}>
                <View style={[styles.distDot, { backgroundColor: cfg.color }]} />
                <Text style={styles.distLabel}>{cfg.label}</Text>
                <View style={styles.distBarTrack}>
                  <View style={[styles.distBarFill, { width: `${pct}%` as any, backgroundColor: cfg.color, opacity: 0.7 }]} />
                </View>
                <Text style={[styles.distCount, { color: cfg.color }]}>{count.toLocaleString()}</Text>
                <Text style={styles.distPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        {/* ── Top 5 Opportunities ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top 5 Opportunities</Text>
          <Text style={styles.cardSub}>Highest distress scores right now</Text>

          {top5.map((p, i) => {
            const cfg = GRADE_CONFIG[p.grade as keyof typeof GRADE_CONFIG] || GRADE_CONFIG.low;
            return (
              <TouchableOpacity
                key={String(p.id)}
                style={styles.topRow}
                onPress={() => setDetail(p)}
                activeOpacity={0.7}
              >
                <Text style={styles.topRank}>#{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topAddr} numberOfLines={1}>{p.address}</Text>
                  <Text style={styles.topCity}>{p.city}, {p.state}</Text>
                </View>
                <Text style={styles.topPrice}>{fmtPrice(p.price)}</Text>
                <View style={[styles.scoreBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                  <View style={[styles.scoreDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.scoreText, { color: cfg.color }]}>{p.score}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Financing Summary ── */}
        {flagEntries.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Financing Signals</Text>
            <Text style={styles.cardSub}>Count of listings by flag</Text>

            {flagEntries.map(([key, count]) => {
              const icon = FINANCING_ICONS[key] || "📌";
              const label = key
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, s => s.toUpperCase())
                .trim();
              const pct = Math.round((count / total) * 100);
              return (
                <View key={key} style={styles.finRow}>
                  <Text style={styles.finIcon}>{icon}</Text>
                  <Text style={styles.finLabel}>{label}</Text>
                  <View style={styles.finBarTrack}>
                    <View style={[styles.finBarFill, { width: `${Math.min(pct * 2, 100)}%` as any }]} />
                  </View>
                  <Text style={styles.finCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Nearby News ── */}
        {recentNews.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Local News</Text>
            <Text style={styles.cardSub}>Recent events affecting the market</Text>

            {recentNews.map((article: any, i: number) => (
              <View key={i} style={styles.newsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.newsHeadline} numberOfLines={2}>{article.headline || article.title}</Text>
                  {article.date && (
                    <Text style={styles.newsDate}>
                      {new Date(article.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  )}
                </View>
                <SentimentBadge sentiment={article.sentiment} />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full detail modal */}
      <Modal visible={!!detail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetail(null)}>
        <DetailSheet
          property={detail}
          onClose={() => setDetail(null)}
          saved={detail ? savedHomes.has(String(detail.id)) : false}
          onToggleSaved={() => detail && toggleSaved(String(detail.id))}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#f9fafb" },
  scroll:      { flex: 1 },
  content:     { padding: 16 },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#6b7280" },

  pageTitle: { fontSize: 22, fontWeight: "800", color: "#111", marginBottom: 16 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111", marginBottom: 2 },
  cardSub:   { fontSize: 12, color: "#9ca3af", marginBottom: 14 },

  distRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  distDot:      { width: 8, height: 8, borderRadius: 4 },
  distLabel:    { fontSize: 13, fontWeight: "600", color: "#374151", width: 34 },
  distBarTrack: { flex: 1, height: 8, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden" },
  distBarFill:  { height: 8, borderRadius: 4 },
  distCount:    { fontSize: 13, fontWeight: "700", width: 40, textAlign: "right" },
  distPct:      { fontSize: 11, color: "#9ca3af", width: 32, textAlign: "right" },

  topRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 0.5, borderColor: "#f3f4f6" },
  topRank:   { fontSize: 13, fontWeight: "700", color: "#9ca3af", width: 24 },
  topAddr:   { fontSize: 13, fontWeight: "600", color: "#111" },
  topCity:   { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  topPrice:  { fontSize: 13, fontWeight: "700", color: "#111" },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  scoreDot:   { width: 5, height: 5, borderRadius: 3 },
  scoreText:  { fontSize: 12, fontWeight: "700" },

  finRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  finIcon:     { fontSize: 16, width: 22 },
  finLabel:    { fontSize: 13, color: "#374151", width: 100 },
  finBarTrack: { flex: 1, height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, overflow: "hidden" },
  finBarFill:  { height: 6, borderRadius: 3, backgroundColor: "#6b7280" },
  finCount:    { fontSize: 13, fontWeight: "700", color: "#374151", width: 36, textAlign: "right" },

  newsRow:      { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderColor: "#f3f4f6" },
  newsHeadline: { fontSize: 13, color: "#111", lineHeight: 18, fontWeight: "500" },
  newsDate:     { fontSize: 11, color: "#9ca3af", marginTop: 3 },
});

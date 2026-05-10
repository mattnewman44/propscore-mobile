import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, SafeAreaView } from "react-native";
import { statColor } from "../lib/marketStats";

interface Stat { abbr: string; label: string; type: string; raw: number | null; display: string; barMax: number; note: string; }

function StatDetail({ stat }: { stat: Stat }) {
  const c = statColor(stat.type, stat.raw);
  const fill = stat.raw && stat.barMax ? Math.min(100, Math.round((stat.raw / stat.barMax) * 100)) : 0;
  return (
    <View style={sd.row}>
      <View style={sd.labelRow}>
        <Text style={[sd.abbr, { color: c.note }]}>{stat.abbr}</Text>
        <Text style={sd.label}>{stat.label}</Text>
        <Text style={[sd.val, { color: c.val }]}>{stat.display}</Text>
      </View>
      <View style={sd.track}>
        <View style={[sd.fill, { width: `${fill}%` as any, backgroundColor: c.bar }]} />
      </View>
      <Text style={[sd.note, { color: c.note }]}>{stat.note}</Text>
    </View>
  );
}

const sd = StyleSheet.create({
  row: { marginBottom: 20 },
  labelRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 6 },
  abbr: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  label: { flex: 1, fontSize: 14, fontWeight: "600", color: "#111" },
  val: { fontSize: 18, fontWeight: "700" },
  track: { height: 10, borderRadius: 5, backgroundColor: "#f3f4f6", overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
  note: { fontSize: 11, marginTop: 4 },
});

export default function MarketStatsBar({ stats }: { stats: Stat[] }) {
  const [modalOpen, setModalOpen] = React.useState(false);

  return (
    <>
      <TouchableOpacity style={styles.bar} onPress={() => setModalOpen(true)} activeOpacity={0.8}>
        {stats.map(s => {
          const c = statColor(s.type, s.raw);
          return (
            <View key={s.abbr} style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }]}>
              <Text style={[styles.pillAbbr, { color: c.note }]}>{s.abbr}</Text>
              <Text style={[styles.pillVal, { color: c.val }]} numberOfLines={1}>{s.display}</Text>
            </View>
          );
        })}
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Market Stats</Text>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.modalSub}>Based on all listings in your current search.</Text>
            {stats.map(s => <StatDetail key={s.abbr} stat={s} />)}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  pill: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 6, alignItems: "center" },
  pillAbbr: { fontSize: 9, fontWeight: "700", letterSpacing: 0.4, lineHeight: 13 },
  pillVal: { fontSize: 12, fontWeight: "700", lineHeight: 15 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderColor: "#e5e7eb" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  modalClose: { fontSize: 15, color: "#2563eb", fontWeight: "600" },
  modalSub: { fontSize: 12, color: "#9ca3af", marginBottom: 20 },
});

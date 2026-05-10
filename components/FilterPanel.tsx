import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, SafeAreaView,
} from "react-native";
import Slider from "@react-native-community/slider";

interface FilterValues {
  priceMin: number;
  priceMax: number;
  scoreMin: number;
  scoreMax: number;
  bedsMin: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  values: FilterValues;
  onApply: (v: FilterValues) => void;
}

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export default function FilterPanel({ visible, onClose, values, onApply }: Props) {
  const [priceMin, setPriceMin] = useState(values.priceMin);
  const [priceMax, setPriceMax] = useState(values.priceMax);
  const [scoreMin, setScoreMin] = useState(values.scoreMin);
  const [scoreMax, setScoreMax] = useState(values.scoreMax);
  const [bedsMin, setBedsMin] = useState(values.bedsMin);

  const reset = () => {
    setPriceMin(0); setPriceMax(2_000_000);
    setScoreMin(0); setScoreMax(100);
    setBedsMin(0);
  };

  const apply = () => {
    onApply({ priceMin, priceMax, scoreMin, scoreMax, bedsMin });
    onClose();
  };

  const BEDS = [0, 1, 2, 3, 4, 5];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={reset}>
            <Text style={styles.reset}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Price range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price range</Text>
            <View style={styles.rangeLabels}>
              <Text style={styles.rangeVal}>{fmtPrice(priceMin)}</Text>
              <Text style={styles.rangeSep}>–</Text>
              <Text style={styles.rangeVal}>{priceMax >= 2_000_000 ? "$2M+" : fmtPrice(priceMax)}</Text>
            </View>
            <Text style={styles.sliderLabel}>Min price</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={2_000_000}
              step={25_000}
              value={priceMin}
              onValueChange={v => setPriceMin(Math.min(v, priceMax - 25_000))}
              minimumTrackTintColor="#2563eb"
              maximumTrackTintColor="#e5e7eb"
              thumbTintColor="#2563eb"
            />
            <Text style={styles.sliderLabel}>Max price</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={2_000_000}
              step={25_000}
              value={priceMax}
              onValueChange={v => setPriceMax(Math.max(v, priceMin + 25_000))}
              minimumTrackTintColor="#2563eb"
              maximumTrackTintColor="#e5e7eb"
              thumbTintColor="#2563eb"
            />
          </View>

          {/* Distress score */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Distress score</Text>
            <View style={styles.rangeLabels}>
              <Text style={styles.rangeVal}>{scoreMin}</Text>
              <Text style={styles.rangeSep}>–</Text>
              <Text style={styles.rangeVal}>{scoreMax}</Text>
            </View>
            <View style={styles.scoreTrack}>
              <View style={[styles.scoreBar, { left: `${scoreMin}%`, right: `${100 - scoreMax}%` }]} />
            </View>
            <Text style={styles.sliderLabel}>Min score</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={scoreMin}
              onValueChange={v => setScoreMin(Math.min(v, scoreMax - 1))}
              minimumTrackTintColor="#dc2626"
              maximumTrackTintColor="#e5e7eb"
              thumbTintColor="#dc2626"
            />
            <Text style={styles.sliderLabel}>Max score</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={scoreMax}
              onValueChange={v => setScoreMax(Math.max(v, scoreMin + 1))}
              minimumTrackTintColor="#dc2626"
              maximumTrackTintColor="#e5e7eb"
              thumbTintColor="#dc2626"
            />
          </View>

          {/* Beds */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Minimum bedrooms</Text>
            <View style={styles.bedRow}>
              {BEDS.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.bedBtn, bedsMin === b && styles.bedBtnActive]}
                  onPress={() => setBedsMin(b)}
                >
                  <Text style={[styles.bedBtnText, bedsMin === b && styles.bedBtnTextActive]}>
                    {b === 0 ? "Any" : `${b}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyBtn} onPress={apply}>
            <Text style={styles.applyBtnText}>Apply filters</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderColor: "#e5e7eb" },
  title: { fontSize: 16, fontWeight: "700", color: "#111" },
  cancel: { fontSize: 15, color: "#6b7280" },
  reset: { fontSize: 15, color: "#2563eb", fontWeight: "600" },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, borderBottomWidth: 0.5, borderColor: "#f3f4f6" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111", marginBottom: 12 },
  rangeLabels: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  rangeVal: { fontSize: 16, fontWeight: "600", color: "#111" },
  rangeSep: { fontSize: 14, color: "#9ca3af" },
  sliderLabel: { fontSize: 12, color: "#6b7280", marginTop: 4, marginBottom: 2 },
  slider: { width: "100%", height: 40 },
  scoreTrack: { height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, marginBottom: 8, position: "relative", overflow: "hidden" },
  scoreBar: { position: "absolute", top: 0, bottom: 0, backgroundColor: "#dc2626", opacity: 0.3 },
  bedRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  bedBtn: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff" },
  bedBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  bedBtnText: { fontSize: 14, color: "#374151" },
  bedBtnTextActive: { color: "#fff", fontWeight: "600" },
  footer: { padding: 16, borderTopWidth: 0.5, borderColor: "#e5e7eb" },
  applyBtn: { backgroundColor: "#111", borderRadius: 12, padding: 16, alignItems: "center" },
  applyBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

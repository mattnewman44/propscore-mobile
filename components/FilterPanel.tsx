import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, SafeAreaView, Switch,
} from "react-native";
import Slider from "@react-native-community/slider";

export interface FilterValues {
  priceMin: number;
  priceMax: number;
  scoreMin: number;
  scoreMax: number;
  bedsMin: number;
  bathsMin: number;
  showDistressedOnly: boolean;
  showSavedOnly: boolean;
  showEnrichedOnly: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  values: FilterValues;
  onApply: (v: FilterValues) => void;
  saleTypeFilter?: string | null;
  onSaleTypeFilter?: (key: string | null) => void;
  saleTypeOptions?: { key: string; label: string }[];
}

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={step.row}>
      <Text style={step.label}>{label}</Text>
      <View style={step.controls}>
        <TouchableOpacity style={step.btn} onPress={() => onChange(Math.max(0, value - 1))}>
          <Text style={step.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={step.val}>{value === 0 ? "Any" : `${value}+`}</Text>
        <TouchableOpacity style={step.btn} onPress={() => onChange(value + 1)}>
          <Text style={step.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const step = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  label: { fontSize: 15, color: "#111", fontWeight: "500" },
  controls: { flexDirection: "row", alignItems: "center", gap: 16 },
  btn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 18, color: "#111", lineHeight: 22 },
  val: { fontSize: 15, fontWeight: "600", color: "#111", minWidth: 40, textAlign: "center" },
});

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={tog.row}>
      <Text style={tog.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#e5e7eb", true: "#111" }}
        thumbColor="#fff"
      />
    </View>
  );
}

const tog = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 0.5, borderColor: "#f3f4f6" },
  label: { fontSize: 15, color: "#111" },
});

export default function FilterPanel({
  visible, onClose, values, onApply,
  saleTypeFilter, onSaleTypeFilter, saleTypeOptions = [],
}: Props) {
  const [priceMin, setPriceMin]                 = useState(values.priceMin);
  const [priceMax, setPriceMax]                 = useState(values.priceMax);
  const [scoreMin, setScoreMin]                 = useState(values.scoreMin);
  const [scoreMax, setScoreMax]                 = useState(values.scoreMax);
  const [bedsMin, setBedsMin]                   = useState(values.bedsMin);
  const [bathsMin, setBathsMin]                 = useState(values.bathsMin);
  const [showDistressedOnly, setShowDistressedOnly] = useState(values.showDistressedOnly);
  const [showSavedOnly, setShowSavedOnly]       = useState(values.showSavedOnly);
  const [showEnrichedOnly, setShowEnrichedOnly] = useState(values.showEnrichedOnly);

  const reset = () => {
    setPriceMin(0); setPriceMax(2_000_000);
    setScoreMin(0); setScoreMax(100);
    setBedsMin(0);  setBathsMin(0);
    setShowDistressedOnly(false);
    setShowSavedOnly(false);
    setShowEnrichedOnly(false);
    onSaleTypeFilter?.(null);
  };

  const apply = () => {
    onApply({ priceMin, priceMax, scoreMin, scoreMax, bedsMin, bathsMin, showDistressedOnly, showSavedOnly, showEnrichedOnly });
    onClose();
  };

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
              <View style={[styles.scoreBar, { left: `${scoreMin}%` as any, right: `${100 - scoreMax}%` as any }]} />
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

          {/* Beds & Baths */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Beds & Baths</Text>
            <Stepper label="Bedrooms"  value={bedsMin}  onChange={setBedsMin}  />
            <Stepper label="Bathrooms" value={bathsMin} onChange={setBathsMin} />
          </View>

          {/* Sale type */}
          {saleTypeOptions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sale type</Text>
              <TouchableOpacity
                style={[styles.saleTypeBtn, !saleTypeFilter && styles.saleTypeBtnActive]}
                onPress={() => onSaleTypeFilter?.(null)}
              >
                <Text style={[styles.saleTypeBtnText, !saleTypeFilter && styles.saleTypeBtnTextActive]}>Any</Text>
              </TouchableOpacity>
              <View style={{ height: 6 }} />
              {saleTypeOptions.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.saleTypeBtn, saleTypeFilter === opt.key && styles.saleTypeBtnActive]}
                  onPress={() => onSaleTypeFilter?.(saleTypeFilter === opt.key ? null : opt.key)}
                >
                  <Text style={[styles.saleTypeBtnText, saleTypeFilter === opt.key && styles.saleTypeBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Other toggles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Other</Text>
            <ToggleRow label="Distressed only (High + Med)" value={showDistressedOnly} onChange={setShowDistressedOnly} />
            <ToggleRow label="Saved listings only"         value={showSavedOnly}       onChange={setShowSavedOnly} />
            <ToggleRow label="Enriched listings only"      value={showEnrichedOnly}    onChange={setShowEnrichedOnly} />
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
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  rangeLabels: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  rangeVal: { fontSize: 16, fontWeight: "600", color: "#111" },
  rangeSep: { fontSize: 14, color: "#9ca3af" },
  sliderLabel: { fontSize: 12, color: "#6b7280", marginTop: 4, marginBottom: 2 },
  slider: { width: "100%", height: 40 },
  scoreTrack: { height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, marginBottom: 8, position: "relative", overflow: "hidden" },
  scoreBar: { position: "absolute", top: 0, bottom: 0, backgroundColor: "#dc2626", opacity: 0.3 },
  footer: { padding: 16, borderTopWidth: 0.5, borderColor: "#e5e7eb" },
  applyBtn: { backgroundColor: "#111", borderRadius: 12, padding: 16, alignItems: "center" },
  applyBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  saleTypeBtn: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff", marginBottom: 8 },
  saleTypeBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  saleTypeBtnText: { fontSize: 14, color: "#374151" },
  saleTypeBtnTextActive: { color: "#fff", fontWeight: "600" },
});

import React from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import {
  useListings,
  SIGNAL_KEYS, SIGNAL_LABELS, SIGNAL_MAXES, WEIGHT_STEPS, DEFAULT_GLOBAL_WEIGHTS,
  type SignalKey,
} from "../lib/ListingsContext";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const GRADE = {
  high:   { dot: "#dc2626", bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
  medium: { dot: "#d97706", bg: "#fffbeb", border: "#fcd34d", text: "#92400e" },
  low:    { dot: "#16a34a", bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
};

function WeightRow({ signalKey }: { signalKey: SignalKey }) {
  const { weights, setWeights, listings, rawListings } = useListings();
  const weight = weights[signalKey];
  const max    = SIGNAL_MAXES[signalKey];

  const stepDown = () => {
    const idx = WEIGHT_STEPS.indexOf(weight);
    if (idx > 0) setWeights(w => ({ ...w, [signalKey]: WEIGHT_STEPS[idx - 1] }));
  };
  const stepUp = () => {
    const idx = WEIGHT_STEPS.indexOf(weight);
    if (idx < WEIGHT_STEPS.length - 1) setWeights(w => ({ ...w, [signalKey]: WEIGHT_STEPS[idx + 1] }));
  };

  // Show avg base signal value across all listings for context
  const avgBase = rawListings.length
    ? Math.round(rawListings.reduce((s, l) => s + (l.signals?.[signalKey] || 0), 0) / rawListings.length * 10) / 10
    : 0;
  const avgUser = Math.round(Math.min(max, avgBase * weight) * 10) / 10;

  return (
    <View style={s.row}>
      <View style={s.labelRow}>
        <Text style={s.label}>{SIGNAL_LABELS[signalKey]}</Text>
        <Text style={s.maxLabel}>max {max} pts</Text>
      </View>

      <View style={s.controls}>
        <TouchableOpacity style={s.stepBtn} onPress={stepDown} disabled={weight === 0}>
          <Text style={[s.stepTxt, weight === 0 && s.stepDisabled]}>−</Text>
        </TouchableOpacity>

        <View style={s.valBox}>
          <Text style={s.valTxt}>{weight === 1 ? "Default" : `${weight}×`}</Text>
        </View>

        <TouchableOpacity style={s.stepBtn} onPress={stepUp} disabled={weight === 2}>
          <Text style={[s.stepTxt, weight === 2 && s.stepDisabled]}>+</Text>
        </TouchableOpacity>

        {weight !== 1 && (
          <Text style={s.delta}>
            avg {avgBase} → {avgUser}/{max}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function WeightsModal({ visible, onClose }: Props) {
  const { weights, resetWeights, hasCustomWeights, listings, rawListings } = useListings();

  const highCount   = listings.filter(l => l.grade === "high").length;
  const medCount    = listings.filter(l => l.grade === "medium").length;
  const lowCount    = listings.filter(l => l.grade === "low").length;
  const rawHigh     = rawListings.filter(l => l.grade === "high").length;
  const rawMed      = rawListings.filter(l => l.grade === "medium").length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>⚖ Signal Weights</Text>
            <Text style={s.subtitle}>Adjust how each signal affects the PropScore</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Distribution preview */}
          <View style={s.distBox}>
            <Text style={s.distTitle}>Score distribution</Text>
            <View style={s.distRow}>
              {[
                { label: "High", count: highCount, raw: rawHigh, g: GRADE.high },
                { label: "Med",  count: medCount,  raw: rawMed,  g: GRADE.medium },
                { label: "Low",  count: lowCount,  raw: rawListings.length - rawHigh - rawMed, g: GRADE.low },
              ].map(({ label, count, raw, g }) => (
                <View key={label} style={[s.distCard, { borderColor: g.border, backgroundColor: g.bg }]}>
                  <Text style={[s.distCount, { color: g.dot }]}>{count}</Text>
                  <Text style={[s.distLabel, { color: g.text }]}>{label}</Text>
                  {hasCustomWeights && count !== raw && (
                    <Text style={[s.distDelta, { color: g.text }]}>
                      {count > raw ? `+${count - raw}` : `${count - raw}`}
                    </Text>
                  )}
                </View>
              ))}
            </View>
            {hasCustomWeights && (
              <Text style={s.distHint}>vs PropScore baseline ↑↓ shows change</Text>
            )}
          </View>

          {/* Explanation */}
          <View style={s.explainBox}>
            <Text style={s.explainTxt}>
              <Text style={{ fontWeight: "700" }}>Default (1×)</Text> uses PropScore as-is.{"\n"}
              Increase a signal to rank it higher in your search — decrease to ignore it.{"\n"}
              All listings re-rank instantly as you adjust.
            </Text>
          </View>

          {/* Per-signal rows */}
          {SIGNAL_KEYS.map(k => <WeightRow key={k} signalKey={k} />)}

          {/* Legend */}
          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: "#dc2626" }]} />
              <Text style={s.legendTxt}>PropScore (solid)</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: "#dc262650" }]} />
              <Text style={s.legendTxt}>User Score (lighter)</Text>
            </View>
          </View>

          {/* Reset */}
          {hasCustomWeights && (
            <TouchableOpacity style={s.resetBtn} onPress={resetWeights}>
              <Text style={s.resetTxt}>Reset to PropScore defaults</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#fff" },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingTop: 24, borderBottomWidth: 0.5, borderColor: "#e5e7eb" },
  title:       { fontSize: 18, fontWeight: "700", color: "#111" },
  subtitle:    { fontSize: 13, color: "#6b7280", marginTop: 2 },
  closeBtn:    { fontSize: 20, color: "#6b7280" },
  scroll:      { flex: 1, padding: 16 },

  distBox:     { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 12 },
  distTitle:   { fontSize: 11, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  distRow:     { flexDirection: "row", gap: 8 },
  distCard:    { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: "center" },
  distCount:   { fontSize: 24, fontWeight: "800" },
  distLabel:   { fontSize: 11, fontWeight: "600", marginTop: 2 },
  distDelta:   { fontSize: 11, fontWeight: "700", marginTop: 2, opacity: 0.7 },
  distHint:    { fontSize: 10, color: "#9ca3af", marginTop: 8, textAlign: "center" },

  explainBox:  { backgroundColor: "#f0f9ff", borderRadius: 10, borderWidth: 1, borderColor: "#bae6fd", padding: 12, marginBottom: 16 },
  explainTxt:  { fontSize: 12, color: "#0369a1", lineHeight: 18 },

  row:         { marginBottom: 18 },
  labelRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  label:       { fontSize: 14, fontWeight: "600", color: "#111" },
  maxLabel:    { fontSize: 11, color: "#9ca3af" },
  controls:    { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn:     { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  stepTxt:     { fontSize: 20, color: "#374151", lineHeight: 24 },
  stepDisabled:{ color: "#d1d5db" },
  valBox:      { flex: 1, alignItems: "center", justifyContent: "center", height: 36, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb" },
  valTxt:      { fontSize: 13, fontWeight: "700", color: "#111" },
  delta:       { fontSize: 11, color: "#6b7280", marginLeft: 4 },

  legend:      { flexDirection: "row", gap: 16, marginTop: 8, marginBottom: 20 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch:      { width: 14, height: 14, borderRadius: 3 },
  legendTxt:   { fontSize: 11, color: "#6b7280" },

  resetBtn:    { alignItems: "center", padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: "#e5e7eb", marginTop: 8 },
  resetTxt:    { fontSize: 14, fontWeight: "600", color: "#6b7280" },
});

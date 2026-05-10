import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, SafeAreaView, KeyboardAvoidingView, Platform,
} from "react-native";
import type { SavedSearch, AlertFreq } from "../lib/savedSearches";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Pass an existing search to edit/update it, or null to create new */
  existing: SavedSearch | null;
  onSave: (name: string, alertFreq: AlertFreq) => void;
}

const FREQ_OPTIONS: { key: AlertFreq; label: string; sub: string }[] = [
  { key: "never",   label: "Never",   sub: "No alerts"       },
  { key: "weekly",  label: "Weekly",  sub: "Mon mornings"    },
  { key: "daily",   label: "Daily",   sub: "7 AM each day"   },
  { key: "instant", label: "Instant", sub: "As they appear"  },
];

export default function SaveSearchModal({ visible, onClose, existing, onSave }: Props) {
  const [name, setName]           = useState("");
  const [alertFreq, setAlertFreq] = useState<AlertFreq>("never");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName(existing?.name ?? "");
      setAlertFreq(existing?.alertFreq ?? "never");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, existing]);

  const isUpdate = !!existing;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, alertFreq);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{isUpdate ? "Update Search" : "Save Search"}</Text>
            <TouchableOpacity onPress={handleSave} disabled={!name.trim()}>
              <Text style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}>
                {isUpdate ? "Update" : "Save"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {/* Name input */}
            <Text style={styles.label}>Search name</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={existing?.name ?? "Name this search…"}
              placeholderTextColor="#9ca3af"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {isUpdate && (
              <Text style={styles.hint}>
                Currently saved as "{existing!.name}"
              </Text>
            )}

            {/* Alert frequency */}
            <Text style={[styles.label, { marginTop: 24 }]}>Alert me about new matches</Text>
            <View style={styles.freqGrid}>
              {FREQ_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.freqBtn, alertFreq === opt.key && styles.freqBtnActive]}
                  onPress={() => setAlertFreq(opt.key)}
                >
                  <Text style={[styles.freqLabel, alertFreq === opt.key && styles.freqLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.freqSub, alertFreq === opt.key && styles.freqSubActive]}>
                    {opt.sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {alertFreq !== "never" && (
              <Text style={styles.alertNote}>
                📧 Email alerts coming soon — we'll notify you at matt@instashowplus.com
              </Text>
            )}
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderColor: "#e5e7eb" },
  title: { fontSize: 16, fontWeight: "700", color: "#111" },
  cancel: { fontSize: 15, color: "#6b7280" },
  saveBtn: { fontSize: 15, color: "#2563eb", fontWeight: "700" },
  saveBtnDisabled: { color: "#d1d5db" },
  body: { padding: 20 },
  label: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  input: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 16, color: "#111", backgroundColor: "#fafafa" },
  hint: { fontSize: 12, color: "#9ca3af", marginTop: 6 },
  freqGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  freqBtn: { width: "47%", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, backgroundColor: "#fff" },
  freqBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  freqLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 2 },
  freqLabelActive: { color: "#fff" },
  freqSub: { fontSize: 11, color: "#9ca3af" },
  freqSubActive: { color: "rgba(255,255,255,0.7)" },
  alertNote: { marginTop: 14, fontSize: 12, color: "#6b7280", lineHeight: 18 },
});

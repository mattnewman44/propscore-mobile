import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, SafeAreaView, Alert,
} from "react-native";
import type { SavedSearch } from "../lib/savedSearches";
import { summarizeSearch } from "../lib/savedSearches";

interface Props {
  visible: boolean;
  onClose: () => void;
  searches: SavedSearch[];
  onApply: (search: SavedSearch) => void;
  onDelete: (id: string) => void;
  onEdit: (search: SavedSearch) => void;
  activeId: string | null;
}

const FREQ_LABELS: Record<string, string> = {
  never:   "",
  weekly:  "📧 Weekly",
  daily:   "📧 Daily",
  instant: "📧 Instant",
};

export default function SavedSearchesModal({
  visible, onClose, searches, onApply, onDelete, onEdit, activeId,
}: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleDelete = (s: SavedSearch) => {
    Alert.alert(
      `Delete "${s.name}"?`,
      "This search will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(s.id) },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Saved Searches</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.done}>Done</Text>
          </TouchableOpacity>
        </View>

        {searches.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔖</Text>
            <Text style={styles.emptyTitle}>No saved searches</Text>
            <Text style={styles.emptyBody}>
              Set your filters and tap "Save Search" to save your current view for quick access later.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {searches.map(s => {
              const isActive = s.id === activeId;
              return (
                <View key={s.id} style={[styles.card, isActive && styles.cardActive]}>
                  {/* Name row */}
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardName, isActive && styles.cardNameActive]} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={styles.cardSummary} numberOfLines={2}>
                        {summarizeSearch(s)}
                      </Text>
                    </View>
                    {FREQ_LABELS[s.alertFreq] ? (
                      <Text style={styles.alertBadge}>{FREQ_LABELS[s.alertFreq]}</Text>
                    ) : null}
                  </View>

                  {/* Action row */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.applyBtn, isActive && styles.applyBtnActive]}
                      onPress={() => { onApply(s); onClose(); }}
                    >
                      <Text style={[styles.applyBtnText, isActive && styles.applyBtnTextActive]}>
                        {isActive ? "✓ Applied" : "Apply"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(s)}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(s)}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 0.5, borderColor: "#e5e7eb" },
  title: { fontSize: 16, fontWeight: "700", color: "#111" },
  done: { fontSize: 15, color: "#2563eb", fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 22 },
  list: { padding: 12, gap: 10 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardActive: { borderWidth: 1.5, borderColor: "#111" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#111", marginBottom: 3 },
  cardNameActive: { color: "#111" },
  cardSummary: { fontSize: 12, color: "#6b7280", lineHeight: 18 },
  alertBadge: { fontSize: 11, color: "#6b7280", marginLeft: 8, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 8 },
  applyBtn: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, paddingVertical: 8, alignItems: "center", backgroundColor: "#fff" },
  applyBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  applyBtnText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  applyBtnTextActive: { color: "#fff" },
  editBtn: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignItems: "center", backgroundColor: "#fff" },
  editBtnText: { fontSize: 13, fontWeight: "500", color: "#374151" },
  deleteBtn: { borderWidth: 1, borderColor: "#fca5a5", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignItems: "center", backgroundColor: "#fff" },
  deleteBtnText: { fontSize: 13, fontWeight: "500", color: "#dc2626" },
});

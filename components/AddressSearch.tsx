import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Keyboard,
} from "react-native";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";

// Fallback: use Vercel API for search if no Mapbox token
const API_BASE = "https://distressed-property-finder-v2.vercel.app";

interface Props {
  onSearch: (address: string) => void;
  loading: boolean;
}

export default function AddressSearch({ onSearch, loading }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json` +
          `?access_token=${MAPBOX_TOKEN}&types=address&country=US&limit=5`
        );
        const json = await res.json();
        const places = (json.features || []).map((f: any) => f.place_name as string);
        setSuggestions(places);
        setShowSuggestions(places.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const handleChange = (text: string) => {
    setQuery(text);
    fetchSuggestions(text);
  };

  const handleSelect = (address: string) => {
    setQuery(address);
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
    onSearch(address);
  };

  const handleSubmit = () => {
    if (!query.trim()) return;
    setShowSuggestions(false);
    Keyboard.dismiss();
    onSearch(query.trim());
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Search any address…"
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={handleChange}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
        />
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnLoading]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.btnText}>Search</Text>
          }
        </TouchableOpacity>
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(_, i) => String(i)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestion} onPress={() => handleSelect(item)}>
                <Text style={styles.suggestionIcon}>📍</Text>
                <Text style={styles.suggestionText} numberOfLines={2}>{item}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, paddingVertical: 8, zIndex: 100 },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#111" },
  btn: { backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center", minWidth: 72, alignItems: "center" },
  btnLoading: { backgroundColor: "#2563eb" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  dropdown: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginTop: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, maxHeight: 220 },
  suggestion: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  suggestionIcon: { fontSize: 14 },
  suggestionText: { flex: 1, fontSize: 13, color: "#111" },
  divider: { height: 0.5, backgroundColor: "#f3f4f6", marginHorizontal: 12 },
});

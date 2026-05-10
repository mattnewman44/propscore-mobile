import React from "react";
import { Text, View, StyleSheet } from "react-native";

interface Props {
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: 18,
  md: 22,
  lg: 28,
};

export default function PropScoreLogo({ size = "md" }: Props) {
  const fontSize = SIZES[size];
  return (
    <View style={styles.row}>
      <Text style={[styles.light, { fontSize }]}>Prop</Text>
      <Text style={[styles.bold,  { fontSize }]}>Score</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline" },
  light: { color: "#111", fontWeight: "400" },
  bold:  { color: "#111", fontWeight: "800" },
});

import { Tabs } from "expo-router";
import { Text } from "react-native";
import { ListingsProvider } from "../../lib/ListingsContext";

export default function TabLayout() {
  return (
    <ListingsProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#e5e7eb" },
        tabBarActiveTintColor: "#111",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "List",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>☰</Text>,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🗺</Text>,
        }}
      />
    </Tabs>
    </ListingsProvider>
  );
}

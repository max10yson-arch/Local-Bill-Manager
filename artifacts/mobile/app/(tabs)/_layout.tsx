import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index"><Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} /><Label>Bill</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="bills"><Icon sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }} /><Label>Bills</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="customers"><Icon sf={{ default: "person.2", selected: "person.2.fill" }} /><Label>Customers</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="products"><Icon sf={{ default: "shippingbox", selected: "shippingbox.fill" }} /><Label>Catalog</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports"><Icon sf={{ default: "chart.bar.doc.horizontal", selected: "chart.bar.doc.horizontal.fill" }} /><Label>Reports</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings"><Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} /><Label>Settings</Label></NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarLabelStyle: { fontFamily: "Inter_700Bold", fontSize: 10 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : undefined,
        },
        tabBarBackground: () => isIOS ? <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : isWeb ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} /> : null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Bill", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="doc.text" tintColor={color} size={24} /> : <Feather name="file-text" size={21} color={color} /> }} />
      <Tabs.Screen name="bills" options={{ title: "Bills", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="list.bullet.rectangle" tintColor={color} size={24} /> : <Feather name="list" size={21} color={color} /> }} />
      <Tabs.Screen name="customers" options={{ title: "Customers", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="person.2" tintColor={color} size={24} /> : <Feather name="users" size={21} color={color} /> }} />
      <Tabs.Screen name="products" options={{ title: "Catalog", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="shippingbox" tintColor={color} size={24} /> : <Feather name="package" size={21} color={color} /> }} />
      <Tabs.Screen name="reports" options={{ title: "Reports", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="chart.bar.doc.horizontal" tintColor={color} size={24} /> : <Feather name="bar-chart-2" size={21} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="gearshape" tintColor={color} size={24} /> : <Feather name="settings" size={21} color={color} /> }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}

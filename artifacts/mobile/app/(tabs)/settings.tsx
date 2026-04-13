import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatCurrency, useBilling } from "@/context/BillingContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, stats } = useBilling();
  const [form, setForm] = useState(settings);

  async function save() {
    await updateSettings({ ...form, defaultGst: Number(form.defaultGst) || 0 });
    Alert.alert("Store settings saved", "New bills will use these details.");
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }]}> 
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}> 
          <Text style={styles.kicker}>Business profile</Text>
          <Text style={styles.title}>Store settings</Text>
          <Text style={styles.heroText}>{formatCurrency(stats.totalRevenue)} lifetime billing on this device</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Input label="Store name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
          <Input label="Address" value={form.address} onChangeText={(address) => setForm({ ...form, address })} multiline />
          <Input label="Phone" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
          <Input label="GSTIN" value={form.gstin} onChangeText={(gstin) => setForm({ ...form, gstin })} />
          <Input label="Default GST %" value={String(form.defaultGst)} onChangeText={(defaultGst) => setForm({ ...form, defaultGst: Number(defaultGst) || 0 })} keyboardType="numeric" />
          <Input label="Default note" value={form.note} onChangeText={(note) => setForm({ ...form, note })} multiline />
        </View>
        <Pressable testID="save-settings" onPress={save} style={[styles.saveButton, { backgroundColor: colors.primary }]}><Feather name="check" size={18} color={colors.primaryForeground} /><Text style={[styles.saveText, { color: colors.primaryForeground }]}>Save settings</Text></Pressable>
        <Pressable
          onPress={() => router.push("/admin")}
          style={[styles.adminLink, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Feather name="github" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.adminTitle, { color: colors.foreground }]}>GitHub website admin</Text>
            <Text style={[styles.adminSub, { color: colors.mutedForeground }]}>
              Edit Parinay Saree Pages repo (data.json, images, translations) with a PAT — no backend.
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>
        <View style={[styles.tipCard, { backgroundColor: colors.goldSoft }]}> 
          <Feather name="database" size={20} color={colors.accent} />
          <Text style={[styles.tipTitle, { color: colors.foreground }]}>Local data storage</Text>
          <Text style={[styles.tipText, { color: colors.mutedForeground }]}>Customers, catalog edits, saved bills, and invoice numbers are stored on this device for quick offline billing.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Input({ label, value, onChangeText, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; keyboardType?: "default" | "numeric" | "phone-pad" }) {
  const colors = useColors();
  return <View style={styles.inputWrap}><Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} keyboardType={keyboardType || "default"} placeholderTextColor={colors.mutedForeground} style={[styles.input, multiline && styles.textarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 18, gap: 14 },
  hero: { borderRadius: 28, padding: 22, gap: 8 },
  kicker: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: "#FFFFFF", fontSize: 34, fontFamily: "Inter_700Bold" },
  heroText: { color: "rgba(255,255,255,0.78)", fontFamily: "Inter_500Medium" },
  card: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 12 },
  inputWrap: { gap: 6 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 12, fontFamily: "Inter_500Medium" },
  textarea: { minHeight: 86, textAlignVertical: "top" },
  saveButton: { borderRadius: 19, padding: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  saveText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  tipCard: { borderRadius: 22, padding: 16, gap: 7 },
  tipTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  tipText: { fontFamily: "Inter_500Medium", lineHeight: 20 },
  adminLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  adminTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  adminSub: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 4, lineHeight: 18 },
});

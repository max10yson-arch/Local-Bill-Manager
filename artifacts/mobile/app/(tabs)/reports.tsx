import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BillListItem, formatCurrency, useBilling } from "@/context/BillingContext";
import { useColors } from "@/hooks/useColors";
import { printSalesReport, shareSalesReport } from "@/utils/salesReportPdf";

type Preset = "week" | "month" | "year" | "custom" | "all";
type Mode = "datewise" | "customer";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startForPreset(preset: Preset) {
  const now = new Date();
  if (preset === "week") now.setDate(now.getDate() - 7);
  if (preset === "month") now.setMonth(now.getMonth() - 1);
  if (preset === "year") now.setFullYear(now.getFullYear() - 1);
  return isoDate(now);
}

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { allBills, stats } = useBilling();
  const [preset, setPreset] = useState<Preset>("month");
  const [mode, setMode] = useState<Mode>("datewise");
  const [from, setFrom] = useState(startForPreset("month"));
  const [to, setTo] = useState(isoDate(new Date()));

  const filtered = useMemo(() => {
    if (preset === "all") return allBills;
    const start = preset === "custom" ? from : startForPreset(preset);
    const end = preset === "custom" ? to : isoDate(new Date());
    return allBills.filter((bill) => bill.date >= start && bill.date <= end);
  }, [allBills, from, preset, to]);

  const customerRows = useMemo(() => {
    const grouped = filtered.reduce<Record<string, { key: string; name: string; phone: string; bills: number; items: number; total: number }>>((acc, bill) => {
      const key = bill.customerId || bill.customerName;
      acc[key] = acc[key] || { key, name: bill.customerName, phone: bill.customerPhone, bills: 0, items: 0, total: 0 };
      acc[key].bills += 1;
      acc[key].items += bill.items.reduce((sum, item) => sum + item.qty, 0);
      acc[key].total += bill.grand;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totalSales = filtered.reduce((sum, bill) => sum + bill.grand, 0);
  const totalItems = filtered.reduce((sum, bill) => sum + bill.items.reduce((inner, item) => inner + item.qty, 0), 0);
  const rangeLabel = preset === "all" ? "All saved invoices" : `${preset === "custom" ? from : startForPreset(preset)} to ${preset === "custom" ? to : isoDate(new Date())}`;
  const reportPayload = { bills: filtered, mode, title: mode === "customer" ? "Customer Sales Report" : "Datewise Sales Report", rangeLabel };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }]}> 
      <FlatList
        data={(mode === "customer" ? customerRows : filtered) as any}
        keyExtractor={(item: any) => mode === "customer" ? item.key : item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        ListHeaderComponent={<View style={styles.headerStack}>
          <View style={[styles.hero, { backgroundColor: colors.primary }]}> 
            <Text style={styles.kicker}>Sales reports</Text>
            <Text style={styles.title}>{formatCurrency(totalSales)}</Text>
            <Text style={styles.heroText}>{filtered.length} bills · {totalItems} items · {stats.customerCount} customers</Text>
          </View>
          <View style={styles.chips}>
            <Chip label="Week" active={preset === "week"} onPress={() => setPreset("week")} />
            <Chip label="Month" active={preset === "month"} onPress={() => setPreset("month")} />
            <Chip label="Year" active={preset === "year"} onPress={() => setPreset("year")} />
            <Chip label="All" active={preset === "all"} onPress={() => setPreset("all")} />
            <Chip label="Custom" active={preset === "custom"} onPress={() => setPreset("custom")} />
          </View>
          {preset === "custom" && <View style={styles.twoCol}><DateField label="From" value={from} onChangeText={setFrom} /><DateField label="To" value={to} onChangeText={setTo} /></View>}
          <View style={styles.chips}>
            <Chip label="Datewise list" active={mode === "datewise"} onPress={() => setMode("datewise")} />
            <Chip label="Per customer" active={mode === "customer"} onPress={() => setMode("customer")} />
          </View>
          <View style={styles.actionRow}>
            <Pressable onPress={() => printSalesReport(reportPayload)} style={[styles.actionButton, { backgroundColor: colors.primary }]}><Feather name="printer" size={17} color={colors.primaryForeground} /><Text style={[styles.actionText, { color: colors.primaryForeground }]}>Print PDF</Text></Pressable>
            <Pressable onPress={() => shareSalesReport(reportPayload)} style={[styles.actionButton, { backgroundColor: colors.goldSoft }]}><Feather name="share" size={17} color={colors.accent} /><Text style={[styles.actionText, { color: colors.accent }]}>Share PDF</Text></Pressable>
          </View>
        </View>}
        renderItem={({ item }: { item: any }) => mode === "customer" ? <CustomerRow item={item} /> : <BillRow item={item} />}
        ListEmptyComponent={<View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="bar-chart-2" size={28} color={colors.accent} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No sales in this range</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Change the date filter or save more bills.</Text></View>}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>{label}</Text></Pressable>;
}

function DateField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  const colors = useColors();
  return <View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} /></View>;
}

function BillRow({ item }: { item: BillListItem }) {
  const colors = useColors();
  return <View style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.rowInfo}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.invoiceNum}</Text><Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>{item.date} · {item.customerName}</Text></View><Text style={[styles.rowAmount, { color: colors.accent }]}>{formatCurrency(item.grand)}</Text></View>;
}

function CustomerRow({ item }: { item: { name: string; phone: string; bills: number; items: number; total: number } }) {
  const colors = useColors();
  return <View style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.rowInfo}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>{item.phone || "No phone"} · {item.bills} bills · {item.items} items</Text></View><Text style={[styles.rowAmount, { color: colors.accent }]}>{formatCurrency(item.total)}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 18, gap: 12 },
  headerStack: { gap: 14, marginBottom: 4 },
  hero: { borderRadius: 28, padding: 22, gap: 8 },
  kicker: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: "#FFFFFF", fontSize: 34, fontFamily: "Inter_700Bold" },
  heroText: { color: "rgba(255,255,255,0.78)", fontFamily: "Inter_500Medium" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  twoCol: { flexDirection: "row", gap: 10 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { fontFamily: "Inter_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, fontFamily: "Inter_500Medium" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  actionText: { fontFamily: "Inter_700Bold" },
  rowCard: { borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: "row", gap: 12, alignItems: "center" },
  rowInfo: { flex: 1 },
  rowTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  rowMeta: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 3 },
  rowAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  empty: { borderWidth: 1, borderRadius: 24, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  emptyText: { fontFamily: "Inter_500Medium", textAlign: "center", lineHeight: 20 },
});

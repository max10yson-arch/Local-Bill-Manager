import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BillListItem, formatCurrency, useBilling } from "@/context/BillingContext";
import { useColors } from "@/hooks/useColors";
import { printInvoice, shareInvoicePdf } from "@/utils/invoicePdf";

export default function BillsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { allBills, customers, settings, loadBillForEditing, deleteBill, stats } = useBilling();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BillListItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allBills.filter((bill) => !q || [bill.invoiceNum, bill.customerName, bill.customerPhone, bill.date].join(" ").toLowerCase().includes(q));
  }, [allBills, query]);

  function getCustomer(bill: BillListItem) {
    return customers.find((customer) => customer.id === bill.customerId);
  }

  function editBill(bill: BillListItem) {
    const customer = getCustomer(bill);
    if (!customer) return;
    loadBillForEditing(customer, bill);
    setSelected(null);
    router.push("/");
  }

  async function printBill(bill: BillListItem) {
    await printInvoice({ settings, customer: { name: bill.customerName, phone: bill.customerPhone, city: bill.customerCity, address: bill.customerAddress }, order: bill });
  }

  async function shareBill(bill: BillListItem) {
    await shareInvoicePdf({ settings, customer: { name: bill.customerName, phone: bill.customerPhone, city: bill.customerCity, address: bill.customerAddress }, order: bill });
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }]}> 
      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.customerId}_${item.id}`}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        ListHeaderComponent={<View style={styles.headerStack}>
          <View style={[styles.hero, { backgroundColor: colors.primary }]}> 
            <Text style={styles.kicker}>Bill archive</Text>
            <Text style={styles.title}>{stats.orderCount} bills</Text>
            <Text style={styles.heroText}>{formatCurrency(stats.totalRevenue)} total saved billing</Text>
          </View>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search invoice, customer, phone" placeholderTextColor={colors.mutedForeground} style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
        </View>}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)} style={[styles.billCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={styles.billInfo}>
              <Text style={[styles.billNo, { color: colors.foreground }]}>{item.invoiceNum}</Text>
              <Text style={[styles.billMeta, { color: colors.mutedForeground }]}>{item.customerName} · {item.date}</Text>
              <Text style={[styles.billMeta, { color: colors.mutedForeground }]}>{item.items.length} items · Saved {formatCurrency(item.discount)} discount</Text>
            </View>
            <View style={styles.billRight}>
              <Text style={[styles.total, { color: colors.primary }]}>{formatCurrency(item.grand)}</Text>
              <View style={styles.quickActions}>
                <Pressable onPress={() => printBill(item)} hitSlop={10}><Feather name="printer" size={18} color={colors.accent} /></Pressable>
                <Pressable onPress={() => editBill(item)} hitSlop={10}><Feather name="edit-2" size={18} color={colors.primary} /></Pressable>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="file-text" size={28} color={colors.accent} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bills yet</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Saved bills will appear here for printing, sharing, editing, and tracking.</Text></View>}
      />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 50 : 8) }]}> 
          <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.foreground }]}>{selected.invoiceNum}</Text><Pressable onPress={() => setSelected(null)}><Feather name="x" size={24} color={colors.foreground} /></Pressable></View>
          <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
            <View style={[styles.summary, { backgroundColor: colors.primary }]}> 
              <Text style={styles.summaryTotal}>{formatCurrency(selected.grand)}</Text>
              <Text style={styles.summaryText}>{selected.customerName} · {selected.date}</Text>
              <Text style={styles.summaryText}>{selected.customerPhone || "No phone saved"}</Text>
            </View>
            <View style={styles.actionRow}>
              <Pressable onPress={() => printBill(selected)} style={[styles.actionButton, { backgroundColor: colors.primary }]}><Feather name="printer" size={17} color={colors.primaryForeground} /><Text style={[styles.actionText, { color: colors.primaryForeground }]}>Print PDF</Text></Pressable>
              <Pressable onPress={() => shareBill(selected)} style={[styles.actionButton, { backgroundColor: colors.secondary }]}><Feather name="share" size={17} color={colors.secondaryForeground} /><Text style={[styles.actionText, { color: colors.secondaryForeground }]}>Share</Text></Pressable>
              <Pressable onPress={() => editBill(selected)} style={[styles.actionButton, { backgroundColor: colors.goldSoft }]}><Feather name="edit-2" size={17} color={colors.primary} /><Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text></Pressable>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Items</Text>
            {selected.items.map((item) => <View key={item.uid} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.billInfo}><Text style={[styles.billNo, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.billMeta, { color: colors.mutedForeground }]}>{item.qty} x {formatCurrency(item.price)}{item.discount ? ` · ${item.discount}% catalog discount` : ""}</Text></View><Text style={[styles.total, { color: colors.primary }]}>{formatCurrency(item.price * item.qty * (1 - (item.discount || 0) / 100))}</Text></View>)}
            <View style={[styles.totalsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TotalRow label="Subtotal" value={formatCurrency(selected.subtotal)} />
              <TotalRow label="Product discount" value={`-${formatCurrency(selected.productDiscount || 0)}`} />
              <TotalRow label="Bill discount" value={`-${formatCurrency(selected.billDiscount || 0)}`} />
              <TotalRow label="GST" value={formatCurrency(selected.gst)} />
              <TotalRow label="Delivery" value={formatCurrency(selected.delivery)} />
            </View>
            <Pressable onPress={() => Alert.alert("Delete bill", "This removes the bill from the customer history.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { deleteBill(selected.customerId, selected.id); setSelected(null); } }])} style={[styles.deleteButton, { backgroundColor: colors.roseSoft }]}><Feather name="trash-2" size={18} color={colors.destructive} /><Text style={[styles.deleteText, { color: colors.destructive }]}>Delete bill</Text></Pressable>
          </ScrollView>
        </View>}
      </Modal>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.totalRow}><Text style={[styles.billMeta, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.total, { color: colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 18, gap: 12 },
  headerStack: { gap: 14, marginBottom: 4 },
  hero: { borderRadius: 28, padding: 22, gap: 8 },
  kicker: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: "#FFFFFF", fontSize: 34, fontFamily: "Inter_700Bold" },
  heroText: { color: "rgba(255,255,255,0.78)", fontFamily: "Inter_500Medium" },
  search: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, fontFamily: "Inter_500Medium" },
  billCard: { borderWidth: 1, borderRadius: 22, padding: 14, flexDirection: "row", gap: 12, alignItems: "center" },
  billInfo: { flex: 1 },
  billNo: { fontFamily: "Inter_700Bold", fontSize: 15 },
  billMeta: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 3 },
  billRight: { alignItems: "flex-end", gap: 10 },
  total: { fontFamily: "Inter_700Bold", fontSize: 15 },
  quickActions: { flexDirection: "row", gap: 14 },
  empty: { borderWidth: 1, borderRadius: 24, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  emptyText: { fontFamily: "Inter_500Medium", textAlign: "center", lineHeight: 20 },
  modal: { flex: 1, paddingHorizontal: 18 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 24, flex: 1 },
  summary: { borderRadius: 26, padding: 20, gap: 6, marginBottom: 14 },
  summaryTotal: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 34 },
  summaryText: { color: "rgba(255,255,255,0.76)", fontFamily: "Inter_500Medium" },
  actionRow: { flexDirection: "row", gap: 9, marginBottom: 18 },
  actionButton: { flex: 1, borderRadius: 18, padding: 13, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 19, marginBottom: 10 },
  itemCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center" },
  totalsCard: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 8, marginTop: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  deleteButton: { marginTop: 14, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  deleteText: { fontFamily: "Inter_700Bold" },
});

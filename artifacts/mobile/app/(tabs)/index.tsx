import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatCurrency, Product, useBilling } from "@/context/BillingContext";
import { useColors } from "@/hooks/useColors";
import { draftToOrder, printInvoice, shareInvoicePdf } from "@/utils/invoicePdf";

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: "default" | "numeric" | "phone-pad" }) {
  const colors = useColors();
  return <View style={styles.field}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} multiline={multiline} keyboardType={keyboardType || "default"} style={[styles.input, multiline && styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} /></View>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label} value={String(value)} keyboardType="numeric" onChangeText={(text) => onChange(Number(text) || 0)} />;
}

export default function BillScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, customers, draft, settings, totals, stats, editingBill, updateDraft, addItem, updateQty, removeItem, saveBill, clearDraft, loadCustomerIntoDraft, isReady } = useBilling();
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => !q || product.name.toLowerCase().includes(q) || product.category.toLowerCase().includes(q));
  }, [products, query]);

  const currentOrder = draftToOrder(draft, totals);

  async function handleSave() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await saveBill();
    setMessage(result.message);
    if (!result.ok) Alert.alert("Bill not saved", result.message);
  }

  async function handlePrint() {
    await printInvoice({ settings, customer: { name: draft.customerName, phone: draft.customerPhone, city: draft.customerCity, address: draft.customerAddress }, order: currentOrder });
  }

  async function handleShare() {
    await shareInvoicePdf({ settings, customer: { name: draft.customerName, phone: draft.customerPhone, city: draft.customerCity, address: draft.customerAddress }, order: currentOrder });
  }

  if (!isReady) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }]}> 
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}> 
          <View><Text style={styles.heroKicker}>Parinay Saree</Text><Text style={styles.heroTitle}>{editingBill ? "Edit bill" : "Bill desk"}</Text><Text style={styles.heroText}>{stats.customerCount} customers · {formatCurrency(stats.totalRevenue)} billed</Text></View>
          <View style={[styles.invoicePill, { backgroundColor: "rgba(255,255,255,0.16)" }]}><Text style={styles.invoicePillLabel}>Invoice</Text><Text style={styles.invoicePillValue}>{draft.invoiceNum}</Text></View>
        </View>
        {!!message && <Text style={[styles.notice, { color: colors.success, backgroundColor: colors.goldSoft }]}>{message}</Text>}
        {editingBill && <Text style={[styles.notice, { color: colors.primary, backgroundColor: colors.roseSoft }]}>Editing saved bill. Save will update the existing invoice instead of creating a new one.</Text>}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.cardHeader}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Customer</Text><Pressable testID="pick-customer" onPress={() => setCustomerPickerOpen(true)} style={[styles.smallButton, { backgroundColor: colors.roseSoft }]}><Feather name="users" size={15} color={colors.primary} /><Text style={[styles.smallButtonText, { color: colors.primary }]}>Pick saved</Text></Pressable></View>
          <Field label="Name" value={draft.customerName} placeholder="Customer full name" onChangeText={(customerName) => updateDraft({ customerName })} />
          <View style={styles.twoCol}><Field label="Phone" value={draft.customerPhone} keyboardType="phone-pad" placeholder="+91" onChangeText={(customerPhone) => updateDraft({ customerPhone })} /><Field label="City / PIN" value={draft.customerCity} placeholder="Indore — 452001" onChangeText={(customerCity) => updateDraft({ customerCity })} /></View>
          <Field label="Address" value={draft.customerAddress} multiline placeholder="Delivery address" onChangeText={(customerAddress) => updateDraft({ customerAddress })} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.cardHeader}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Products</Text><Pressable testID="add-product" onPress={() => setProductPickerOpen(true)} style={[styles.primaryMini, { backgroundColor: colors.primary }]}><Feather name="plus" size={16} color={colors.primaryForeground} /><Text style={[styles.primaryMiniText, { color: colors.primaryForeground }]}>Add</Text></Pressable></View>
          {draft.items.length === 0 ? <View style={[styles.emptyBox, { backgroundColor: colors.goldSoft }]}><Feather name="shopping-bag" size={24} color={colors.accent} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No items yet</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Add catalog or custom products to build the bill.</Text></View> : draft.items.map((item) => {
            const discounted = item.price * item.qty * (1 - (item.discount || 0) / 100);
            return <View key={item.uid} style={[styles.itemRow, { borderColor: colors.border }]}><View style={styles.itemInfo}><Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{item.category} · {formatCurrency(item.price)}{item.discount ? ` · ${item.discount}% off` : ""}</Text></View><View style={styles.qtyBox}><Pressable onPress={() => updateQty(item.uid, item.qty - 1)} style={[styles.qtyBtn, { backgroundColor: colors.muted }]}><Feather name="minus" size={14} color={colors.foreground} /></Pressable><Text style={[styles.qtyText, { color: colors.foreground }]}>{item.qty}</Text><Pressable onPress={() => updateQty(item.uid, item.qty + 1)} style={[styles.qtyBtn, { backgroundColor: colors.muted }]}><Feather name="plus" size={14} color={colors.foreground} /></Pressable></View><Text style={[styles.itemTotal, { color: colors.primary }]}>{formatCurrency(discounted)}</Text><Pressable onPress={() => removeItem(item.uid)} hitSlop={10}><Feather name="x" size={18} color={colors.destructive} /></Pressable></View>;
          })}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Charges</Text>
          <View style={styles.threeCol}><NumberField label="GST %" value={draft.gstRate} onChange={(gstRate) => updateDraft({ gstRate })} /><NumberField label="Bill Disc %" value={draft.discountRate} onChange={(discountRate) => updateDraft({ discountRate })} /><NumberField label="Delivery" value={draft.delivery} onChange={(delivery) => updateDraft({ delivery })} /></View>
          <Field label="Payment / note" value={draft.notes} multiline onChangeText={(notes) => updateDraft({ notes })} />
        </View>

        <View style={[styles.previewCard, { backgroundColor: colors.primary }]}> 
          <View style={styles.previewHeader}><View><Text style={styles.previewStore}>{settings.name}</Text><Text style={styles.previewMuted}>{settings.phone}</Text></View><View style={styles.previewRight}><Text style={styles.previewMuted}>{draft.date}</Text><Text style={styles.previewInvoice}>{draft.invoiceNum}</Text></View></View>
          <View style={styles.previewLine} /><Text style={styles.previewMuted}>Bill To</Text><Text style={styles.previewCustomer}>{draft.customerName || "Customer not selected"}</Text>
          <View style={styles.totalRows}><Row label="Subtotal" value={formatCurrency(totals.subtotal)} />{totals.productDiscount > 0 && <Row label="Catalog discount" value={`-${formatCurrency(totals.productDiscount)}`} />}{totals.billDiscount > 0 && <Row label="Bill discount" value={`-${formatCurrency(totals.billDiscount)}`} />}<Row label="GST" value={formatCurrency(totals.gst)} /><Row label="Delivery" value={formatCurrency(totals.delivery)} /></View>
          <View style={[styles.grandRow, { backgroundColor: "rgba(255,255,255,0.14)" }]}><Text style={styles.grandLabel}>Total Amount</Text><Text style={[styles.grandValue, { color: colors.accent }]}>{formatCurrency(totals.grand)}</Text></View>
        </View>

        <View style={styles.actions}>
          <Pressable testID="save-bill" onPress={handleSave} style={[styles.actionButton, { backgroundColor: colors.primary }]}><Feather name="save" size={19} color={colors.primaryForeground} /><Text style={[styles.actionText, { color: colors.primaryForeground }]}>{editingBill ? "Update saved bill" : "Save bill and customer"}</Text></Pressable>
          <View style={styles.twoCol}><Pressable onPress={handlePrint} style={[styles.actionButton, { backgroundColor: colors.secondary, flex: 1 }]}><Feather name="printer" size={18} color={colors.secondaryForeground} /><Text style={[styles.actionText, { color: colors.secondaryForeground }]}>Print PDF</Text></Pressable><Pressable onPress={handleShare} style={[styles.actionButton, { backgroundColor: colors.goldSoft, flex: 1 }]}><Feather name="share" size={18} color={colors.primary} /><Text style={[styles.actionText, { color: colors.primary }]}>Share PDF</Text></Pressable></View>
          <Pressable onPress={clearDraft} style={[styles.actionButton, { backgroundColor: colors.secondary }]}><Feather name="refresh-cw" size={18} color={colors.secondaryForeground} /><Text style={[styles.actionText, { color: colors.secondaryForeground }]}>New bill</Text></Pressable>
        </View>
      </ScrollView>

      <Modal visible={productPickerOpen} animationType="slide" onRequestClose={() => setProductPickerOpen(false)}>
        <View style={[styles.modalScreen, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 50 : 8) }]}> 
          <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.foreground }]}>Add products</Text><Pressable onPress={() => setProductPickerOpen(false)}><Feather name="x" size={24} color={colors.foreground} /></Pressable></View>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search sarees, bedsheets" placeholderTextColor={colors.mutedForeground} style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
          <FlatList data={filteredProducts} keyExtractor={(item) => item.id} contentContainerStyle={styles.modalList} renderItem={({ item }) => <Pressable onPress={() => { addItem(item); Haptics.selectionAsync(); }} style={[styles.productRow, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.itemInfo}><Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{item.category}{item.discount ? ` · ${item.discount}% catalog discount` : ""}</Text></View><Text style={[styles.itemTotal, { color: colors.primary }]}>{formatCurrency(item.price)}</Text><Feather name="plus-circle" size={22} color={colors.primary} /></Pressable>} ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center", marginTop: 40 }]}>No products found.</Text>} />
        </View>
      </Modal>

      <Modal visible={customerPickerOpen} animationType="slide" onRequestClose={() => setCustomerPickerOpen(false)}>
        <View style={[styles.modalScreen, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 50 : 8) }]}> 
          <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.foreground }]}>Saved customers</Text><Pressable onPress={() => setCustomerPickerOpen(false)}><Feather name="x" size={24} color={colors.foreground} /></Pressable></View>
          <FlatList data={customers} keyExtractor={(item) => item.id} contentContainerStyle={styles.modalList} renderItem={({ item }) => <Pressable onPress={() => { loadCustomerIntoDraft(item); setCustomerPickerOpen(false); }} style={[styles.productRow, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.itemInfo}><Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{item.phone || item.city || "No contact saved"}</Text></View><Text style={[styles.itemTotal, { color: colors.primary }]}>{formatCurrency(item.totalSpent)}</Text></Pressable>} ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center", marginTop: 40 }]}>No saved customers yet.</Text>} />
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.billRow}><Text style={styles.billRowLabel}>{label}</Text><Text style={styles.billRowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, loading: { flex: 1, alignItems: "center", justifyContent: "center" }, scroll: { padding: 18, gap: 16 }, hero: { borderRadius: 28, padding: 22, minHeight: 150, flexDirection: "row", justifyContent: "space-between", overflow: "hidden" }, heroKicker: { color: "rgba(255,255,255,0.72)", fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2 }, heroTitle: { color: "#FFFFFF", fontSize: 34, fontFamily: "Inter_700Bold", marginTop: 6 }, heroText: { color: "rgba(255,255,255,0.78)", fontSize: 14, marginTop: 8, fontFamily: "Inter_500Medium" }, invoicePill: { padding: 12, borderRadius: 18, alignSelf: "flex-start", alignItems: "flex-end" }, invoicePillLabel: { color: "rgba(255,255,255,0.68)", fontSize: 11, fontFamily: "Inter_600SemiBold" }, invoicePillValue: { color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_700Bold" }, notice: { padding: 12, borderRadius: 16, fontFamily: "Inter_600SemiBold" }, card: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 12 }, cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold" }, field: { flex: 1, gap: 6 }, label: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 }, input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_500Medium" }, textarea: { minHeight: 74, textAlignVertical: "top" }, twoCol: { flexDirection: "row", gap: 10 }, threeCol: { flexDirection: "row", gap: 8 }, smallButton: { flexDirection: "row", gap: 6, alignItems: "center", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, smallButtonText: { fontSize: 12, fontFamily: "Inter_700Bold" }, primaryMini: { flexDirection: "row", gap: 6, alignItems: "center", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }, primaryMiniText: { fontSize: 13, fontFamily: "Inter_700Bold" }, emptyBox: { alignItems: "center", padding: 18, borderRadius: 20, gap: 7 }, emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" }, emptyText: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_500Medium" }, itemRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, paddingVertical: 12, gap: 10 }, productRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 10, gap: 12 }, itemInfo: { flex: 1 }, itemName: { fontSize: 15, fontFamily: "Inter_700Bold" }, itemMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 3 }, itemTotal: { fontSize: 14, fontFamily: "Inter_700Bold" }, qtyBox: { flexDirection: "row", alignItems: "center", gap: 8 }, qtyBtn: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }, qtyText: { minWidth: 18, textAlign: "center", fontFamily: "Inter_700Bold" }, previewCard: { borderRadius: 28, padding: 18, gap: 14 }, previewHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, previewStore: { color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_700Bold" }, previewMuted: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_500Medium" }, previewRight: { alignItems: "flex-end" }, previewInvoice: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 3 }, previewLine: { height: 1, backgroundColor: "rgba(255,255,255,0.18)" }, previewCustomer: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" }, totalRows: { gap: 7 }, billRow: { flexDirection: "row", justifyContent: "space-between" }, billRowLabel: { color: "rgba(255,255,255,0.72)", fontSize: 13, fontFamily: "Inter_500Medium" }, billRowValue: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" }, grandRow: { borderRadius: 18, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, grandLabel: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 }, grandValue: { fontSize: 25, fontFamily: "Inter_700Bold" }, actions: { gap: 10 }, actionButton: { borderRadius: 19, paddingVertical: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9 }, actionText: { fontSize: 13, fontFamily: "Inter_700Bold" }, modalScreen: { flex: 1, paddingHorizontal: 18 }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 }, modalTitle: { fontSize: 24, fontFamily: "Inter_700Bold" }, search: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, fontFamily: "Inter_500Medium", marginBottom: 14 }, modalList: { paddingBottom: 34 }
});

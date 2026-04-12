import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Customer, formatCurrency, useBilling } from "@/context/BillingContext";
import { useColors } from "@/hooks/useColors";

export default function CustomersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { customers, stats, saveCustomerProfile, deleteCustomer, loadCustomerIntoDraft } = useBilling();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...customers]
      .sort((a, b) => (b.lastSeen || b.createdAt).localeCompare(a.lastSeen || a.createdAt))
      .filter((customer) => !q || [customer.name, customer.phone, customer.city].join(" ").toLowerCase().includes(q));
  }, [customers, query]);

  function openNewCustomer() {
    setEditing({ id: `customer_${Date.now()}`, name: "", phone: "", city: "", address: "", orders: [], totalSpent: 0, lastSeen: "", createdAt: new Date().toISOString().slice(0, 10) });
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={[styles.hero, { backgroundColor: colors.primary }]}> 
              <Text style={styles.kicker}>Customer management</Text>
              <Text style={styles.title}>Relationships</Text>
              <Text style={styles.heroText}>{stats.orderCount} orders · Avg {formatCurrency(stats.averageOrder)}</Text>
              {stats.topCustomer && <Text style={styles.heroText}>Top customer: {stats.topCustomer.name}</Text>}
            </View>
            <View style={styles.searchRow}>
              <TextInput value={query} onChangeText={setQuery} placeholder="Search customers" placeholderTextColor={colors.mutedForeground} style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
              <Pressable testID="new-customer" onPress={openNewCustomer} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" color={colors.primaryForeground} size={22} /></Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => setDetail(item)} style={[styles.customerCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={styles.avatar}><Text style={[styles.avatarText, { color: colors.primary }]}>{item.name.slice(0, 1).toUpperCase() || "C"}</Text></View>
            <View style={styles.customerInfo}>
              <Text style={[styles.customerName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.customerMeta, { color: colors.mutedForeground }]}>{item.phone || "No phone"}{item.city ? ` · ${item.city}` : ""}</Text>
              <Text style={[styles.customerMeta, { color: colors.mutedForeground }]}>{item.orders.length} orders · Last {item.lastSeen || "not billed"}</Text>
            </View>
            <View style={styles.spendBox}>
              <Text style={[styles.spend, { color: colors.primary }]}>{formatCurrency(item.totalSpent)}</Text>
              <Pressable onPress={() => setEditing(item)} hitSlop={10}><Feather name="edit-2" size={17} color={colors.accent} /></Pressable>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="user-plus" size={28} color={colors.accent} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No customers yet</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Save a bill or create a customer profile to start tracking history.</Text></View>}
      />

      <CustomerEditor visible={!!editing} customer={editing} onClose={() => setEditing(null)} onSave={async (customer) => { await saveCustomerProfile(customer); setEditing(null); }} />

      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        {detail && <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 50 : 8) }]}> 
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{detail.name}</Text>
            <Pressable onPress={() => setDetail(null)}><Feather name="x" size={24} color={colors.foreground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 34 }}>
            <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}> 
              <Text style={styles.summaryAmount}>{formatCurrency(detail.totalSpent)}</Text>
              <Text style={styles.summaryText}>{detail.orders.length} orders · Last visit {detail.lastSeen || "not billed"}</Text>
              <Text style={styles.summaryText}>{detail.phone || "No phone saved"}</Text>
            </View>
            <View style={styles.detailActions}>
              <Pressable onPress={() => { loadCustomerIntoDraft(detail); setDetail(null); }} style={[styles.detailButton, { backgroundColor: colors.primary }]}><Feather name="file-plus" size={17} color={colors.primaryForeground} /><Text style={[styles.detailButtonText, { color: colors.primaryForeground }]}>Use in bill</Text></Pressable>
              <Pressable onPress={() => { setEditing(detail); setDetail(null); }} style={[styles.detailButton, { backgroundColor: colors.secondary }]}><Feather name="edit-2" size={17} color={colors.secondaryForeground} /><Text style={[styles.detailButtonText, { color: colors.secondaryForeground }]}>Edit</Text></Pressable>
              <Pressable onPress={() => Alert.alert("Delete customer", "This removes the profile and order history from this device.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { deleteCustomer(detail.id); setDetail(null); } }])} style={[styles.iconDanger, { backgroundColor: colors.roseSoft }]}><Feather name="trash-2" size={18} color={colors.destructive} /></Pressable>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Order history</Text>
            {detail.orders.length ? detail.orders.map((order) => (
              <View key={order.id} style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <View style={styles.orderHeader}><Text style={[styles.orderNo, { color: colors.foreground }]}>{order.invoiceNum}</Text><Text style={[styles.spend, { color: colors.primary }]}>{formatCurrency(order.grand)}</Text></View>
                <Text style={[styles.customerMeta, { color: colors.mutedForeground }]}>{order.date} · {order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}</Text>
              </View>
            )) : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No bills saved for this customer yet.</Text>}
          </ScrollView>
        </View>}
      </Modal>
    </View>
  );
}

function CustomerEditor({ visible, customer, onClose, onSave }: { visible: boolean; customer: Customer | null; onClose: () => void; onSave: (customer: Omit<Customer, "orders" | "totalSpent" | "lastSeen" | "createdAt">) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ id: "", name: "", phone: "", city: "", address: "" });

  React.useEffect(() => {
    if (customer) setForm({ id: customer.id, name: customer.name, phone: customer.phone, city: customer.city, address: customer.address });
  }, [customer]);

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 50 : 8) }]}> 
      <View style={styles.modalHeader}>
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>{customer?.orders?.length ? "Edit customer" : "New customer"}</Text>
        <Pressable onPress={onClose}><Feather name="x" size={24} color={colors.foreground} /></Pressable>
      </View>
      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <Input label="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
        <Input label="Phone" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
        <Input label="City / PIN" value={form.city} onChangeText={(city) => setForm({ ...form, city })} />
        <Input label="Address" value={form.address} onChangeText={(address) => setForm({ ...form, address })} multiline />
      </View>
      <Pressable onPress={() => form.name.trim() ? onSave(form) : Alert.alert("Name required", "Add customer name before saving.")} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
        <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Save customer</Text>
      </Pressable>
    </View>
  </Modal>;
}

function Input({ label, value, onChangeText, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; keyboardType?: "default" | "phone-pad" }) {
  const colors = useColors();
  return <View style={styles.inputWrap}><Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} keyboardType={keyboardType || "default"} placeholderTextColor={colors.mutedForeground} style={[styles.input, multiline && styles.textarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 18, gap: 12 },
  headerStack: { gap: 14, marginBottom: 4 },
  hero: { borderRadius: 28, padding: 22, gap: 6 },
  kicker: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: "#FFFFFF", fontSize: 34, fontFamily: "Inter_700Bold" },
  heroText: { color: "rgba(255,255,255,0.78)", fontFamily: "Inter_500Medium" },
  searchRow: { flexDirection: "row", gap: 10 },
  search: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, fontFamily: "Inter_500Medium" },
  addButton: { width: 50, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  customerCard: { borderWidth: 1, borderRadius: 22, padding: 14, flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FBE8F0", alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 18 },
  customerInfo: { flex: 1 },
  customerName: { fontFamily: "Inter_700Bold", fontSize: 16 },
  customerMeta: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 3 },
  spendBox: { alignItems: "flex-end", gap: 8 },
  spend: { fontFamily: "Inter_700Bold", fontSize: 14 },
  empty: { borderWidth: 1, borderRadius: 24, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  emptyText: { fontFamily: "Inter_500Medium", textAlign: "center", lineHeight: 20 },
  modal: { flex: 1, paddingHorizontal: 18 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 24, flex: 1 },
  summaryCard: { borderRadius: 26, padding: 20, gap: 6, marginBottom: 14 },
  summaryAmount: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 34 },
  summaryText: { color: "rgba(255,255,255,0.76)", fontFamily: "Inter_500Medium" },
  detailActions: { flexDirection: "row", gap: 10, marginBottom: 18 },
  detailButton: { flex: 1, borderRadius: 18, padding: 13, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  detailButtonText: { fontFamily: "Inter_700Bold" },
  iconDanger: { width: 48, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 19, marginBottom: 10 },
  orderCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 10 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between" },
  orderNo: { fontFamily: "Inter_700Bold", fontSize: 15 },
  formCard: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 12 },
  inputWrap: { gap: 6 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, fontFamily: "Inter_500Medium" },
  textarea: { minHeight: 86, textAlignVertical: "top" },
  saveButton: { marginTop: 14, borderRadius: 19, padding: 15, alignItems: "center" },
  saveText: { fontFamily: "Inter_700Bold", fontSize: 15 },
});

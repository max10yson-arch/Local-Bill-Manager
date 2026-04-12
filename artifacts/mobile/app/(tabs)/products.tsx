import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatCurrency, ProductCategory, useBilling } from "@/context/BillingContext";
import { useColors } from "@/hooks/useColors";

export default function ProductsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, catalogStatus, isSyncing, syncProducts, addProduct } = useBilling();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | ProductCategory>("All");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => (category === "All" || product.category === category) && (!q || product.name.toLowerCase().includes(q)));
  }, [products, query, category]);

  const counts = useMemo(() => ({ all: products.length, saree: products.filter((item) => item.category === "Saree").length, bedsheet: products.filter((item) => item.category === "Bedsheet").length, custom: products.filter((item) => item.category === "Custom").length }), [products]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }]}> 
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        ListHeaderComponent={<View style={styles.headerStack}><View style={[styles.hero, { backgroundColor: colors.primary }]}><Text style={styles.kicker}>Catalog</Text><Text style={styles.title}>{counts.all} products</Text><Text style={styles.heroText}>{catalogStatus}</Text><Pressable testID="sync-products" onPress={syncProducts} disabled={isSyncing} style={[styles.syncButton, { backgroundColor: "rgba(255,255,255,0.16)" }]}>{isSyncing ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="download-cloud" size={18} color="#FFFFFF" />}<Text style={styles.syncText}>{isSyncing ? "Syncing" : "Sync from repo"}</Text></Pressable></View><View style={styles.searchRow}><TextInput value={query} onChangeText={setQuery} placeholder="Search catalog" placeholderTextColor={colors.mutedForeground} style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} /><Pressable onPress={() => setModalOpen(true)} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" color={colors.primaryForeground} size={22} /></Pressable></View><View style={styles.chips}><Chip label={`All ${counts.all}`} active={category === "All"} onPress={() => setCategory("All")} /><Chip label={`Sarees ${counts.saree}`} active={category === "Saree"} onPress={() => setCategory("Saree")} /><Chip label={`Bedsheets ${counts.bedsheet}`} active={category === "Bedsheet"} onPress={() => setCategory("Bedsheet")} /><Chip label={`Custom ${counts.custom}`} active={category === "Custom"} onPress={() => setCategory("Custom")} /></View></View>}
        renderItem={({ item }) => <View style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.productIcon, { backgroundColor: item.category === "Saree" ? colors.roseSoft : colors.goldSoft }]}><Feather name={item.category === "Bedsheet" ? "home" : "shopping-bag"} size={19} color={item.category === "Bedsheet" ? colors.accent : colors.primary} /></View><View style={styles.productInfo}><Text style={[styles.productName, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.productMeta, { color: colors.mutedForeground }]}>{item.category}{item.discount ? ` · ${item.discount}% discount` : ""}</Text></View><View style={styles.priceBox}><Text style={[styles.price, { color: colors.primary }]}>{formatCurrency(item.price)}</Text>{item.discount ? <Text style={[styles.discount, { color: colors.success }]}>-{item.discount}%</Text> : null}</View></View>}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No products match your search.</Text>}
      />
      <AddProductModal visible={modalOpen} onClose={() => setModalOpen(false)} onSave={async (product) => { await addProduct(product); setModalOpen(false); }} />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>{label}</Text></Pressable>;
}

function AddProductModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (product: { name: string; price: number; category: ProductCategory; discount: number }) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [category, setCategory] = useState<ProductCategory>("Custom");
  function handleSave() {
    const amount = Number(price);
    if (!name.trim() || !amount) { Alert.alert("Product details needed", "Enter a product name and valid price."); return; }
    onSave({ name: name.trim(), price: amount, category, discount: Math.max(0, Math.min(100, Number(discount) || 0)) });
    setName(""); setPrice(""); setDiscount("0"); setCategory("Custom");
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 50 : 8) }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.foreground }]}>Add custom product</Text><Pressable onPress={onClose}><Feather name="x" size={24} color={colors.foreground} /></Pressable></View><View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}><TextInput value={name} onChangeText={setName} placeholder="Product name" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} /><TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="Price" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} /><TextInput value={discount} onChangeText={setDiscount} keyboardType="numeric" placeholder="Discount %" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} /><View style={styles.chips}><Chip label="Saree" active={category === "Saree"} onPress={() => setCategory("Saree")} /><Chip label="Bedsheet" active={category === "Bedsheet"} onPress={() => setCategory("Bedsheet")} /><Chip label="Custom" active={category === "Custom"} onPress={() => setCategory("Custom")} /></View></View><Pressable onPress={handleSave} style={[styles.saveButton, { backgroundColor: colors.primary }]}><Text style={[styles.saveText, { color: colors.primaryForeground }]}>Save product</Text></Pressable></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, list: { padding: 18, gap: 12 }, headerStack: { gap: 14, marginBottom: 4 }, hero: { borderRadius: 28, padding: 22, gap: 8 }, kicker: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" }, title: { color: "#FFFFFF", fontSize: 34, fontFamily: "Inter_700Bold" }, heroText: { color: "rgba(255,255,255,0.78)", fontFamily: "Inter_500Medium" }, syncButton: { marginTop: 8, alignSelf: "flex-start", flexDirection: "row", gap: 8, alignItems: "center", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }, syncText: { color: "#FFFFFF", fontFamily: "Inter_700Bold" }, searchRow: { flexDirection: "row", gap: 10 }, search: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, fontFamily: "Inter_500Medium" }, addButton: { width: 50, borderRadius: 18, alignItems: "center", justifyContent: "center" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }, chipText: { fontFamily: "Inter_700Bold", fontSize: 12 }, productCard: { borderWidth: 1, borderRadius: 22, padding: 14, flexDirection: "row", gap: 12, alignItems: "center" }, productIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" }, productInfo: { flex: 1 }, productName: { fontFamily: "Inter_700Bold", fontSize: 15 }, productMeta: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 3 }, priceBox: { alignItems: "flex-end" }, price: { fontFamily: "Inter_700Bold", fontSize: 15 }, discount: { fontFamily: "Inter_700Bold", fontSize: 12, marginTop: 2 }, emptyText: { fontFamily: "Inter_500Medium", textAlign: "center", padding: 30 }, modal: { flex: 1, paddingHorizontal: 18 }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 }, modalTitle: { fontFamily: "Inter_700Bold", fontSize: 24, flex: 1 }, formCard: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 12 }, input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 12, fontFamily: "Inter_500Medium" }, saveButton: { marginTop: 14, borderRadius: 19, padding: 15, alignItems: "center" }, saveText: { fontFamily: "Inter_700Bold", fontSize: 15 }
});

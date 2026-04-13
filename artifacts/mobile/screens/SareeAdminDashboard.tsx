import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getDynamicAppStrings, useGitHubAdmin } from "@/context/GitHubAdminContext";
import { useColors } from "@/hooks/useColors";
import type { CatalogRoot, Product, ProductCategory } from "@/types/sareeCatalog";

const PAGE_SIZE = 20;

const BULK_ACTIONS: { id: string; label: string }[] = [
  { id: "set_live", label: "Set Live" },
  { id: "set_hidden", label: "Set Hidden" },
  { id: "set_archived", label: "Set Archived" },
  { id: "discount_10", label: "Discount 10%" },
  { id: "discount_20", label: "Discount 20%" },
  { id: "discount_25", label: "Discount 25%" },
  { id: "discount_50", label: "Discount 50%" },
  { id: "remove_discount", label: "Remove discount" },
  { id: "set_badge_new", label: "Badge: New" },
  { id: "set_badge_sale", label: "Badge: Sale" },
  { id: "set_badge_trending", label: "Badge: Trending" },
  { id: "remove_badge", label: "Remove badge" },
  { id: "set_stock_zero", label: "Stock 0" },
  { id: "delete", label: "Delete selected" },
];

function cfgField(
  gh: ReturnType<typeof useGitHubAdmin>,
  label: string,
  key: string,
  value: string,
  multiline?: boolean,
) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => gh.updateConfig({ [key]: t })}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMulti]}
        placeholderTextColor="#888"
      />
    </View>
  );
}

export function SareeAdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const gh = useGitHubAdmin();
  const [category, setCategory] = useState<ProductCategory>("sarees");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"default" | "newest" | "oldest">("default");
  const [statusTab, setStatusTab] = useState<"all" | "live" | "hidden" | "archived">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [commitMsg, setCommitMsg] = useState("");
  const [commitOpen, setCommitOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [transOpen, setTransOpen] = useState(false);
  const [transSearch, setTransSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("₹0");
  const [newStock, setNewStock] = useState("0");
  const [newDiscount, setNewDiscount] = useState("0");
  const [newStatus, setNewStatus] = useState<"live" | "hidden" | "archived">("live");
  const [newBadge, setNewBadge] = useState<"" | "new" | "sale" | "trending">("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState<ProductCategory>("sarees");

  const baseUrl = gh.getPagesBaseUrl();

  const allInCategory = gh.products[category] || [];
  const filtered = useMemo(() => {
    let list = [...allInCategory];
    if (statusTab !== "all") {
      list = list.filter((p) => (p.status || "live") === statusTab);
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => (p.name || "").toLowerCase().includes(q));
    if (sort === "newest")
      list.sort((a, b) => String(b.dateAdded || "").localeCompare(String(a.dateAdded || "")));
    else if (sort === "oldest")
      list.sort((a, b) => String(a.dateAdded || "").localeCompare(String(b.dateAdded || "")));
    return list;
  }, [allInCategory, search, sort, statusTab]);

  const visible = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [category, statusTab, search, sort]);

  const metrics = useMemo(() => {
    const s = gh.products.sarees || [];
    const b = gh.products.bedsheets || [];
    const all = [...s, ...b];
    const outOfStock = all.filter((p) => (p.stock || 0) <= 0).length;
    const onSale = all.filter((p) => (p.discount || 0) > 0).length;
    const hidden = all.filter((p) => p.status === "hidden").length;
    const archived = all.filter((p) => p.status === "archived").length;
    const live = all.filter((p) => !p.status || p.status === "live").length;
    return { total: all.length, s: s.length, b: b.length, outOfStock, onSale, hidden, archived, live };
  }, [gh.products]);

  const pickImage = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library access to upload images.");
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (res.canceled || !res.assets[0]) return null;
    return res.assets[0].uri;
  };

  const openLive = () => {
    if (baseUrl) void WebBrowser.openBrowserAsync(baseUrl);
  };

  const openPreview = () => {
    if (baseUrl) void WebBrowser.openBrowserAsync(baseUrl);
  };

  const runCleanup = async () => {
    setBusy(true);
    try {
      const orphans = await gh.listOrphanImageCandidates();
      setBusy(false);
      if (orphans.length === 0) {
        Alert.alert("Cleanup", "No orphan images found under assets/sarees, assets/bedsheets, assets/banners.");
        return;
      }
      Alert.alert(
        "Orphan images",
        `Found ${orphans.length} file(s) not referenced by data.json. Queue them for delete on commit?\n\n${orphans.slice(0, 12).join("\n")}${orphans.length > 12 ? "\n…" : ""}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Queue deletes",
            style: "destructive",
            onPress: async () => {
              setBusy(true);
              await gh.queueOrphanDeletes(orphans);
              setBusy(false);
              Alert.alert("Queued", "Commit changes to remove files from GitHub.");
            },
          },
        ],
      );
    } catch (e: unknown) {
      setBusy(false);
      Alert.alert("Cleanup failed", e instanceof Error ? e.message : "Unknown error");
    }
  };

  const exportPdf = async () => {
    if (visible.length === 0) {
      Alert.alert("Export", "No products in the current view.");
      return;
    }
    const d = new Date().toLocaleDateString("en-IN");
    const tabName = statusTab.charAt(0).toUpperCase() + statusTab.slice(1);
    const catName = category.charAt(0).toUpperCase() + category.slice(1);
    let rows = "";
    visible.forEach((p, idx) => {
      const priceStr = String(p.price || "").replace(/[^0-9.]/g, "");
      const price = parseFloat(priceStr) || 0;
      const st = p.status || "live";
      rows += `<tr><td>${idx + 1}</td><td>${escapeHtml(p.name)}</td><td>₹${price.toLocaleString("en-IN")}</td><td>${p.stock ?? ""}</td><td>${p.discount || 0}%</td><td>${p.badge || "-"}</td><td>${st}</td></tr>`;
    });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body{font-family:system-ui;padding:24px;color:#222}
      h1{color:#7B1338} table{border-collapse:collapse;width:100%;font-size:13px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}
      th{background:#f9f5ef;color:#7B1338}
    </style></head><body>
    <h1>Parinay Saree — ${catName}</h1>
    <p>Date ${d} · Filter ${tabName} · ${visible.length} items</p>
    <table><thead><tr><th>#</th><th>Name</th><th>Price</th><th>Stock</th><th>Disc</th><th>Badge</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else Alert.alert("PDF", `Saved to ${uri}`);
    } catch (e: unknown) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Unknown");
    }
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllVisible = () => {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map((p) => p.id)));
  };

  const runBulk = async () => {
    if (!bulkAction) {
      Alert.alert("Bulk", "Choose an action first.");
      return;
    }
    const ids = [...selected];
    if (ids.length === 0) {
      Alert.alert("Bulk", "Select products using the checkboxes.");
      return;
    }
    if (bulkAction === "delete") {
      Alert.alert("Delete products", `Permanently delete ${ids.length} product(s) and queue images?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            await gh.bulkAction(category, ids, bulkAction);
            setBusy(false);
            setSelected(new Set());
            setBulkAction("");
          },
        },
      ]);
      return;
    }
    setBusy(true);
    await gh.bulkAction(category, ids, bulkAction);
    setBusy(false);
    setSelected(new Set());
    setBulkAction("");
  };

  const submitCommit = async () => {
    setBusy(true);
    try {
      await gh.commitChanges(commitMsg);
      setCommitOpen(false);
      setCommitMsg("");
      Alert.alert("Committed", "Changes were pushed to GitHub.");
    } catch (e: unknown) {
      Alert.alert("Commit failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const addNewProduct = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setBusy(true);
    try {
      const path = await gh.uploadProductImage(newCat, uri);
      await gh.addProduct(newCat, {
        name: newName || "New product",
        price: newPrice,
        stock: Number(newStock) || 0,
        discount: Number(newDiscount) || 0,
        status: newStatus,
        badge: newBadge || "",
        description: newDesc,
        image: path,
      });
      setNewName("");
      setNewDesc("");
    } catch (e: unknown) {
      Alert.alert("Add failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setBusy(false);
    }
  };

  const sc = gh.siteConfig as Record<string, string | undefined>;

  const translationKeys = useMemo(() => {
    const catalogSlice: CatalogRoot = {
      site_config: gh.siteConfig,
      products: { sarees: gh.products.sarees, bedsheets: gh.products.bedsheets },
    };
    const dyn = new Set(getDynamicAppStrings(catalogSlice));
    const keys = new Set([...Object.keys(gh.translations), ...dyn]);
    return Array.from(keys).sort((a, b) => {
      const av = gh.translations[a] || "";
      const bv = gh.translations[b] || "";
      if (!av && bv) return -1;
      if (av && !bv) return 1;
      return a.localeCompare(b);
    });
  }, [gh.translations, gh.siteConfig, gh.products]);

  const filteredTransKeys = useMemo(() => {
    const q = transSearch.trim().toLowerCase();
    if (!q) return translationKeys;
    return translationKeys.filter(
      (k) => k.toLowerCase().includes(q) || (gh.translations[k] || "").toLowerCase().includes(q),
    );
  }, [translationKeys, transSearch, gh.translations]);

  const renderProduct = ({ item }: { item: Product }) => {
    const st = item.status || "live";
    const checked = selected.has(item.id);
    return (
      <Pressable
        onPress={() => setEditProduct(item)}
        style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <Pressable onPress={() => toggleSelect(item.id)} style={styles.checkHit}>
          <Feather name={checked ? "check-square" : "square"} size={22} color={colors.primary} />
        </Pressable>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
            {item.price} · stock {item.stock} · {st}
            {item.badge ? ` · ${item.badge}` : ""}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </Pressable>
    );
  };

  const reorderData = gh.products[category] || [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Text style={[styles.repo, { color: colors.mutedForeground }]}>
              {gh.auth?.username}/{gh.auth?.repo}
            </Text>
            <View style={styles.metrics}>
              <Metric label="Total" value={metrics.total} />
              <Metric label="Sarees" value={metrics.s} />
              <Metric label="Bedsheets" value={metrics.b} />
              <Metric label="Live" value={metrics.live} />
              <Metric label="OOS" value={metrics.outOfStock} />
              <Metric label="Sale" value={metrics.onSale} />
            </View>
            <View style={styles.toolbar}>
              <ToolBtn icon="globe" label="Live site" onPress={openLive} />
              <ToolBtn icon="book-open" label="Translations" onPress={() => setTransOpen(true)} />
              <ToolBtn icon="eye" label="Preview" onPress={openPreview} />
              <ToolBtn icon="trash-2" label="Cleanup" onPress={() => void runCleanup()} />
              <ToolBtn icon="share" label="PDF" onPress={() => void exportPdf()} />
            </View>
            <Pressable
              onPress={() => setCommitOpen(true)}
              style={[styles.commitBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="upload-cloud" size={18} color={colors.primaryForeground} />
              <Text style={[styles.commitTxt, { color: colors.primaryForeground }]}>Commit to GitHub</Text>
            </Pressable>
            {(gh.hasUnsavedChanges || gh.hasUnsavedTranslations) && (
              <Text style={{ color: "#c05621", fontSize: 13 }}>You have unpublished changes.</Text>
            )}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Site configuration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(
                  [
                    ["hero_cover", "Hero cover"],
                    ["sarees_cover", "Sarees cover"],
                    ["bedsheets_cover", "Bedsheets cover"],
                    ["home_sarees_cover", "Home sarees img"],
                    ["home_bedsheets_cover", "Home bedsheets img"],
                  ] as const
                ).map(([key, label]) => (
                  <Pressable
                    key={key}
                    onPress={async () => {
                      const u = await pickImage();
                      if (!u) return;
                      setBusy(true);
                      try {
                        await gh.uploadConfigImage(key, u);
                      } catch (e: unknown) {
                        Alert.alert("Upload failed", e instanceof Error ? e.message : "");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    style={[styles.uploadChip, { borderColor: colors.border }]}
                  >
                    <Text style={{ fontSize: 12, color: colors.foreground }}>{label}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 10, color: colors.mutedForeground }}>
                      {(sc[key] as string)?.split("/").pop() || "Tap to upload"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            {cfgField(gh, "Delivery label", "delivery_value", sc.delivery_value || "")}
            {cfgField(gh, "WhatsApp number", "whatsapp_number", sc.whatsapp_number || "")}
            {cfgField(gh, "Hero title", "hero_title", sc.hero_title || "")}
            {cfgField(gh, "Hero subtitle", "hero_subtitle", sc.hero_subtitle || "", true)}
            {cfgField(gh, "Sarees title", "sarees_title", sc.sarees_title || "")}
            {cfgField(gh, "Sarees subtitle", "sarees_subtitle", sc.sarees_subtitle || "", true)}
            {cfgField(gh, "Bedsheets title", "bedsheets_title", sc.bedsheets_title || "")}
            {cfgField(gh, "Bedsheets subtitle", "bedsheets_subtitle", sc.bedsheets_subtitle || "", true)}
            {cfgField(gh, "Home sarees title", "home_sarees_title", sc.home_sarees_title || "")}
            {cfgField(gh, "Home sarees subtitle", "home_sarees_subtitle", sc.home_sarees_subtitle || "", true)}
            {cfgField(gh, "Home bedsheets title", "home_bedsheets_title", sc.home_bedsheets_title || "")}
            {cfgField(gh, "Home bedsheets subtitle", "home_bedsheets_subtitle", sc.home_bedsheets_subtitle || "", true)}
            {cfgField(gh, "About title", "about_title", sc.about_title || "")}
            {cfgField(gh, "About subtitle", "about_subtitle", sc.about_subtitle || "", true)}
            {cfgField(gh, "Feature 1 title", "about_f1_title", sc.about_f1_title || "")}
            {cfgField(gh, "Feature 1 text", "about_f1_desc", sc.about_f1_desc || "", true)}
            {cfgField(gh, "Feature 2 title", "about_f2_title", sc.about_f2_title || "")}
            {cfgField(gh, "Feature 2 text", "about_f2_desc", sc.about_f2_desc || "", true)}
            {cfgField(gh, "Feature 3 title", "about_f3_title", sc.about_f3_title || "")}
            {cfgField(gh, "Feature 3 text", "about_f3_desc", sc.about_f3_desc || "", true)}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Add product</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["sarees", "bedsheets"] as const).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setNewCat(c)}
                  style={[
                    styles.catChip,
                    { borderColor: colors.border },
                    newCat === c && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={{ color: newCat === c ? colors.primaryForeground : colors.foreground }}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholder="Name"
              value={newName}
              onChangeText={setNewName}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholderTextColor="#888"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                placeholder="Price"
                value={newPrice}
                onChangeText={setNewPrice}
                style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.foreground }]}
                placeholderTextColor="#888"
              />
              <TextInput
                placeholder="Stock"
                value={newStock}
                onChangeText={setNewStock}
                keyboardType="numeric"
                style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.foreground }]}
                placeholderTextColor="#888"
              />
              <TextInput
                placeholder="% disc"
                value={newDiscount}
                onChangeText={setNewDiscount}
                keyboardType="numeric"
                style={[styles.input, { width: 72, borderColor: colors.border, color: colors.foreground }]}
                placeholderTextColor="#888"
              />
            </View>
            <TextInput
              placeholder="Description"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              style={[styles.input, styles.inputMulti, { borderColor: colors.border, color: colors.foreground }]}
              placeholderTextColor="#888"
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["live", "hidden", "archived"] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setNewStatus(s)}
                  style={[styles.catChip, newStatus === s && { backgroundColor: colors.accent }]}
                >
                  <Text>{s}</Text>
                </Pressable>
              ))}
              {(["", "new", "sale", "trending"] as const).map((b) => (
                <Pressable
                  key={b || "none"}
                  onPress={() => setNewBadge(b)}
                  style={[styles.catChip, newBadge === b && { backgroundColor: colors.goldSoft }]}
                >
                  <Text>{b || "no badge"}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => void addNewProduct()}
              style={[styles.commitBtn, { backgroundColor: "#276749" }]}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Add product (pick main image)</Text>
            </Pressable>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Manage products</Text>
              <Pressable onPress={() => setReorderOpen(true)}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>Reorder</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["sarees", "bedsheets"] as const).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.catChip, category === c && { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: category === c ? "#fff" : colors.foreground }}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholder="Search name…"
              value={search}
              onChangeText={setSearch}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholderTextColor="#888"
            />
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["default", "newest", "oldest"] as const).map((s) => (
                <Pressable key={s} onPress={() => setSort(s)} style={[styles.catChip, sort === s && { borderWidth: 2, borderColor: colors.primary }]}>
                  <Text style={{ fontSize: 12 }}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(["all", "live", "hidden", "archived"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setStatusTab(t)}
                  style={[styles.tab, statusTab === t && { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: statusTab === t ? "#fff" : colors.foreground, fontSize: 12 }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={selectAllVisible} style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.primary }}>{selected.size === visible.length ? "Clear selection" : "Select all (visible)"}</Text>
            </Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Bulk:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {BULK_ACTIONS.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => setBulkAction(a.id)}
                      style={[styles.bulkChip, bulkAction === a.id && { backgroundColor: colors.primary }]}
                    >
                      <Text style={{ fontSize: 11, color: bulkAction === a.id ? "#fff" : colors.foreground }}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <Pressable onPress={() => void runBulk()} style={{ marginBottom: 12 }}>
              <Text style={{ color: "#c53030", fontWeight: "700" }}>Apply bulk action</Text>
            </Pressable>
            {visible.length < filtered.length ? (
              <Pressable onPress={() => setPage((p) => p + 1)} style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>Load next {PAGE_SIZE}</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <Modal visible={commitOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Commit message</Text>
            <TextInput
              value={commitMsg}
              onChangeText={setCommitMsg}
              placeholder="Update catalog"
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholderTextColor="#888"
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <Pressable onPress={() => setCommitOpen(false)} style={styles.modalBtn}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => void submitCommit()} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Commit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editProduct} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalLarge, { backgroundColor: colors.card }]}>
            <Text style={styles.modalTitle}>Edit product</Text>
            {editProduct ? (
              <EditProductBody
                product={editProduct}
                category={category}
                onClose={() => setEditProduct(null)}
                gh={gh}
                setBusy={setBusy}
                pickImage={pickImage}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={reorderOpen} animationType="slide">
        <View style={{ flex: 1, paddingTop: insets.top + 8, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Reorder {category}</Text>
            <Pressable onPress={() => setReorderOpen(false)}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Done</Text>
            </Pressable>
          </View>
          <DraggableFlatList
            data={reorderData}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) => {
              void gh.reorderProducts(
                category,
                data.map((p) => p.id),
              );
            }}
            renderItem={({ item, drag, isActive }: RenderItemParams<Product>) => (
              <ScaleDecorator>
                <Pressable
                  onLongPress={drag}
                  disabled={isActive}
                  style={[styles.dragRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Feather name="menu" size={20} color={colors.mutedForeground} />
                  <Text style={{ flex: 1, marginLeft: 12, color: colors.foreground }} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Pressable>
              </ScaleDecorator>
            )}
          />
        </View>
      </Modal>

      <Modal visible={transOpen} animationType="slide">
        <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", padding: 12, alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => setTransOpen(false)}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Close</Text>
            </Pressable>
            <TextInput
              style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Search…"
              value={transSearch}
              onChangeText={setTransSearch}
              placeholderTextColor="#888"
            />
            <Pressable
              onPress={() => {
                const k = `New ${Date.now()}`;
                gh.addTranslationRow(k, "");
              }}
            >
              <Feather name="plus-circle" size={26} color={colors.primary} />
            </Pressable>
          </View>
          <FlatList
            data={filteredTransKeys}
            keyExtractor={(k) => k}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            renderItem={({ item: key }) => (
              <View style={[styles.transRow, { borderColor: colors.border }]}>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>{key}</Text>
                <TextInput
                  value={gh.translations[key] || ""}
                  onChangeText={(t) => gh.setTranslation(key, t)}
                  placeholder="Hindi translation"
                  style={[styles.input, styles.inputMulti]}
                  placeholderTextColor="#888"
                />
                <Pressable onPress={() => gh.removeTranslation(key)} style={{ marginTop: 6 }}>
                  <Text style={{ color: "#c53030", fontSize: 12 }}>Remove</Text>
                </Pressable>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricVal}>{value}</Text>
      <Text style={styles.metricLbl}>{label}</Text>
    </View>
  );
}

function ToolBtn({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.toolBtn}>
      <Feather name={icon} size={18} color="#7B1338" />
      <Text style={styles.toolLbl}>{label}</Text>
    </Pressable>
  );
}

function EditProductBody({
  product,
  category,
  onClose,
  gh,
  setBusy,
  pickImage,
}: {
  product: Product;
  category: ProductCategory;
  onClose: () => void;
  gh: ReturnType<typeof useGitHubAdmin>;
  setBusy: (v: boolean) => void;
  pickImage: () => Promise<string | null>;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price);
  const [stock, setStock] = useState(String(product.stock ?? 0));
  const [discount, setDiscount] = useState(String(product.discount ?? 0));
  const [desc, setDesc] = useState(product.description || "");
  const [status, setStatus] = useState<"live" | "hidden" | "archived">((product.status as "live") || "live");
  const [badge, setBadge] = useState<string>(product.badge || "");
  const [image, setImage] = useState(product.image);
  const [more, setMore] = useState<string[]>([...(product.more_images || [])]);

  const save = async () => {
    setBusy(true);
    try {
      await gh.editProduct(category, product.id, {
        name,
        price,
        stock: Number(stock) || 0,
        discount: Number(discount) || 0,
        description: desc,
        status,
        badge: badge as Product["badge"],
        image,
        more_images: more,
      });
      onClose();
    } catch (e: unknown) {
      Alert.alert("Save failed", e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };

  const replaceMain = async () => {
    const u = await pickImage();
    if (!u) return;
    setBusy(true);
    try {
      const p = await gh.uploadProductImage(category, u);
      setImage(p);
    } finally {
      setBusy(false);
    }
  };

  const addExtra = async () => {
    const u = await pickImage();
    if (!u) return;
    setBusy(true);
    try {
      const p = await gh.uploadProductImage(category, u);
      setMore((m) => [...m, p]);
    } finally {
      setBusy(false);
    }
  };

  const removeExtra = (path: string) => {
    setMore((m) => m.filter((x) => x !== path));
  };

  const delProduct = () => {
    Alert.alert("Delete", "Remove this product and queue images?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          await gh.deleteProduct(category, product.id);
          setBusy(false);
          onClose();
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ maxHeight: 480 }}>
      <TextInput value={name} onChangeText={setName} style={styles.input} />
      <TextInput value={price} onChangeText={setPrice} style={styles.input} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput value={stock} onChangeText={setStock} keyboardType="numeric" style={[styles.input, { flex: 1 }]} />
        <TextInput value={discount} onChangeText={setDiscount} keyboardType="numeric" style={[styles.input, { flex: 1 }]} />
      </View>
      <TextInput value={desc} onChangeText={setDesc} multiline style={[styles.input, styles.inputMulti]} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }}>
        {(["live", "hidden", "archived"] as const).map((s) => (
          <Pressable key={s} onPress={() => setStatus(s)} style={[styles.catChip, status === s && { backgroundColor: "#7B1338" }]}>
            <Text style={{ color: status === s ? "#fff" : "#000" }}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {(["", "new", "sale", "trending"] as const).map((b) => (
          <Pressable key={b || "n"} onPress={() => setBadge(b)} style={[styles.catChip, badge === b && { backgroundColor: "#B08D57" }]}>
            <Text>{b || "no badge"}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => void replaceMain()} style={styles.secondaryBtn}>
        <Text>Replace main image</Text>
      </Pressable>
      <Text style={{ fontSize: 11, color: "#666", marginVertical: 4 }}>{image}</Text>
      <Pressable onPress={() => void addExtra()} style={styles.secondaryBtn}>
        <Text>Add extra image</Text>
      </Pressable>
      {more.map((m) => (
        <View key={m} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 11 }}>
            {m}
          </Text>
          <Pressable onPress={() => removeExtra(m)}>
            <Text style={{ color: "#c53030" }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        <Pressable onPress={onClose} style={styles.modalBtn}>
          <Text>Cancel</Text>
        </Pressable>
        <Pressable onPress={() => void save()} style={[styles.modalBtn, { backgroundColor: "#276749" }]}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
        </Pressable>
      </View>
      <Pressable onPress={delProduct} style={{ marginTop: 20, marginBottom: 24 }}>
        <Text style={{ color: "#c53030", textAlign: "center" }}>Delete product</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  busy: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.35)",
    zIndex: 10,
  },
  repo: { fontSize: 13, paddingHorizontal: 16, paddingTop: 8 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 },
  metric: {
    width: "30%",
    minWidth: 96,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fdf8f2",
    borderWidth: 1,
    borderColor: "#f0e4d4",
  },
  metricVal: { fontSize: 18, fontWeight: "800", color: "#7B1338" },
  metricLbl: { fontSize: 11, color: "#555", marginTop: 2 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },
  toolLbl: { fontSize: 12, color: "#333" },
  commitBtn: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  commitTxt: { fontWeight: "800", fontSize: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "800", marginTop: 8, paddingHorizontal: 16 },
  field: { paddingHorizontal: 16, marginBottom: 4 },
  fieldLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  uploadChip: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    width: 120,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  bulkChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkHit: { paddingRight: 8 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "700" },
  rowMeta: { fontSize: 12, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: { borderRadius: 16, padding: 20 },
  modalLarge: { borderRadius: 16, padding: 16, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#ccc" },
  dragRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  transRow: { marginHorizontal: 12, marginBottom: 12, padding: 10, borderWidth: 1, borderRadius: 12 },
  secondaryBtn: {
    padding: 10,
    backgroundColor: "#eee",
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 4,
  },
});

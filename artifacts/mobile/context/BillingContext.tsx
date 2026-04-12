import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ProductCategory = "Saree" | "Bedsheet" | "Custom";

export type Product = {
  id: string;
  name: string;
  price: number;
  category: ProductCategory;
  status?: string;
};

export type BillItem = Product & {
  uid: string;
  qty: number;
};

export type StoreSettings = {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  defaultGst: number;
  note: string;
};

export type BillDraft = {
  invoiceNum: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  gstRate: number;
  discountRate: number;
  delivery: number;
  notes: string;
  items: BillItem[];
};

export type Order = {
  id: string;
  invoiceNum: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  gst: number;
  delivery: number;
  grand: number;
  notes: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  orders: Order[];
  totalSpent: number;
  lastSeen: string;
  createdAt: string;
};

type Totals = {
  subtotal: number;
  discount: number;
  taxable: number;
  gst: number;
  delivery: number;
  grand: number;
};

type BillingContextValue = {
  products: Product[];
  customers: Customer[];
  draft: BillDraft;
  settings: StoreSettings;
  isReady: boolean;
  isSyncing: boolean;
  catalogStatus: string;
  totals: Totals;
  stats: {
    customerCount: number;
    orderCount: number;
    totalRevenue: number;
    averageOrder: number;
    topCustomer?: Customer;
  };
  updateDraft: (patch: Partial<BillDraft>) => void;
  updateSettings: (patch: Partial<StoreSettings>) => Promise<void>;
  syncProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  addItem: (product: Product) => void;
  updateQty: (uid: string, qty: number) => void;
  removeItem: (uid: string) => void;
  clearDraft: () => void;
  saveBill: () => Promise<{ ok: boolean; message: string; customer?: Customer }>;
  saveCustomerProfile: (customer: Omit<Customer, "orders" | "totalSpent" | "lastSeen" | "createdAt">) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  loadCustomerIntoDraft: (customer: Customer) => void;
};

const PRODUCT_SOURCE = "https://raw.githubusercontent.com/Apoc-lengend/saree/main/data.json";
const STORAGE_KEYS = {
  products: "parinay_mobile_products",
  customers: "parinay_mobile_customers",
  draft: "parinay_mobile_draft",
  settings: "parinay_mobile_settings",
  invoiceNum: "parinay_mobile_invoice_num",
};

const fallbackProducts: Product[] = [
  { id: "saree_silk_001", name: "Banarasi Silk Saree", price: 5490, category: "Saree" },
  { id: "saree_cotton_002", name: "Soft Cotton Saree", price: 1890, category: "Saree" },
  { id: "saree_kalamkari_003", name: "Printed Kalamkari Saree", price: 2590, category: "Saree" },
  { id: "saree_party_004", name: "Party Wear Saree", price: 3290, category: "Saree" },
  { id: "bedsheet_king_001", name: "King Size Cotton Bedsheet", price: 1290, category: "Bedsheet" },
  { id: "bedsheet_double_002", name: "Double Bed Floral Bedsheet", price: 990, category: "Bedsheet" },
];

const defaultSettings: StoreSettings = {
  name: "Parinay Saree",
  address: "Your Store Address, City, State — PIN",
  phone: "+91 98765 43210",
  gstin: "",
  defaultGst: 5,
  note: "Thank you for your purchase. Exchange as per store policy.",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parsePrice(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    return Number(cleaned) || 0;
  }
  return 0;
}

function createDraft(invoiceNum: number, settings: StoreSettings): BillDraft {
  return {
    invoiceNum: `INV-${invoiceNum}`,
    date: today(),
    customerName: "",
    customerPhone: "",
    customerCity: "",
    customerAddress: "",
    gstRate: settings.defaultGst,
    discountRate: 0,
    delivery: 0,
    notes: settings.note,
    items: [],
  };
}

function calculateTotals(draft: BillDraft): Totals {
  const subtotal = draft.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = subtotal * Math.max(0, draft.discountRate || 0) / 100;
  const taxable = Math.max(0, subtotal - discount);
  const gst = taxable * Math.max(0, draft.gstRate || 0) / 100;
  const delivery = Math.max(0, draft.delivery || 0);
  const grand = taxable + gst + delivery;
  return { subtotal, discount, taxable, gst, delivery, grand };
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [draft, setDraft] = useState<BillDraft>(() => createDraft(1000, defaultSettings));
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState("Using starter catalog");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const savedSettings = await readJson<StoreSettings>(STORAGE_KEYS.settings, defaultSettings);
      const invoiceNumRaw = await AsyncStorage.getItem(STORAGE_KEYS.invoiceNum);
      const invoiceNum = Number(invoiceNumRaw || "1000") || 1000;
      const savedDraft = await readJson<BillDraft | null>(STORAGE_KEYS.draft, null);
      const savedCustomers = await readJson<Customer[]>(STORAGE_KEYS.customers, []);
      const savedProducts = await readJson<Product[]>(STORAGE_KEYS.products, fallbackProducts);
      if (!mounted) return;
      setSettings(savedSettings);
      setCustomers(savedCustomers);
      setProducts(savedProducts.length ? savedProducts : fallbackProducts);
      setDraft(savedDraft ?? createDraft(invoiceNum, savedSettings));
      setCatalogStatus(savedProducts.length ? `${savedProducts.length} products available offline` : "Using starter catalog");
      setIsReady(true);
    }
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isReady) writeJson(STORAGE_KEYS.draft, draft);
  }, [draft, isReady]);

  const totals = useMemo(() => calculateTotals(draft), [draft]);

  const stats = useMemo(() => {
    const orderCount = customers.reduce((sum, customer) => sum + customer.orders.length, 0);
    const totalRevenue = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);
    const topCustomer = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];
    return {
      customerCount: customers.length,
      orderCount,
      totalRevenue,
      averageOrder: orderCount ? totalRevenue / orderCount : 0,
      topCustomer,
    };
  }, [customers]);

  const updateDraft = useCallback((patch: Partial<BillDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const updateSettings = useCallback(async (patch: Partial<StoreSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await writeJson(STORAGE_KEYS.settings, next);
  }, [settings]);

  const syncProducts = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`${PRODUCT_SOURCE}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Catalog not reachable");
      const data = await response.json();
      const live = (item: { status?: string }) => !item.status || item.status === "live";
      const remoteProducts: Product[] = [
        ...((data?.products?.sarees ?? []).filter(live).map((item: { id?: string; name?: string; price?: unknown }) => ({
          id: item.id || makeId("saree"),
          name: item.name || "Unnamed Saree",
          price: parsePrice(item.price),
          category: "Saree" as const,
        }))),
        ...((data?.products?.bedsheets ?? []).filter(live).map((item: { id?: string; name?: string; price?: unknown }) => ({
          id: item.id || makeId("bedsheet"),
          name: item.name || "Unnamed Bedsheet",
          price: parsePrice(item.price),
          category: "Bedsheet" as const,
        }))),
      ].filter((item) => item.price > 0);
      if (!remoteProducts.length) throw new Error("Catalog has no live products");
      setProducts(remoteProducts);
      await writeJson(STORAGE_KEYS.products, remoteProducts);
      setCatalogStatus(`${remoteProducts.length} products synced from catalog`);
    } catch {
      setCatalogStatus(`${products.length} offline products available`);
    } finally {
      setIsSyncing(false);
    }
  }, [products.length]);

  const addProduct = useCallback(async (product: Omit<Product, "id">) => {
    const next = [{ id: makeId("product"), ...product }, ...products];
    setProducts(next);
    await writeJson(STORAGE_KEYS.products, next);
    setCatalogStatus(`${next.length} products available offline`);
  }, [products]);

  const addItem = useCallback((product: Product) => {
    setDraft((current) => {
      const existing = current.items.find((item) => item.id === product.id && item.category === product.category);
      const items = existing
        ? current.items.map((item) => item.uid === existing.uid ? { ...item, qty: item.qty + 1 } : item)
        : [{ ...product, uid: makeId("item"), qty: 1 }, ...current.items];
      return { ...current, items };
    });
  }, []);

  const updateQty = useCallback((uid: string, qty: number) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.uid === uid ? { ...item, qty: Math.max(1, qty || 1) } : item),
    }));
  }, []);

  const removeItem = useCallback((uid: string) => {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.uid !== uid) }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(createDraft(Number(draft.invoiceNum.replace(/\D/g, "")) || 1000, settings));
  }, [draft.invoiceNum, settings]);

  const saveBill = useCallback(async () => {
    if (!draft.customerName.trim()) return { ok: false, message: "Customer name is required." };
    if (!draft.items.length) return { ok: false, message: "Add at least one product." };
    const order: Order = {
      id: makeId("order"),
      invoiceNum: draft.invoiceNum,
      date: draft.date || today(),
      items: draft.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      gst: totals.gst,
      delivery: totals.delivery,
      grand: totals.grand,
      notes: draft.notes,
    };
    const phone = draft.customerPhone.trim();
    const name = draft.customerName.trim();
    const existing = customers.find((customer) => phone ? customer.phone === phone : customer.name.toLowerCase() === name.toLowerCase());
    const nextCustomer: Customer = existing ? {
      ...existing,
      name,
      phone,
      city: draft.customerCity,
      address: draft.customerAddress,
      orders: [order, ...existing.orders],
      totalSpent: existing.totalSpent + order.grand,
      lastSeen: order.date,
    } : {
      id: makeId("customer"),
      name,
      phone,
      city: draft.customerCity,
      address: draft.customerAddress,
      orders: [order],
      totalSpent: order.grand,
      lastSeen: order.date,
      createdAt: today(),
    };
    const nextCustomers = existing ? customers.map((customer) => customer.id === existing.id ? nextCustomer : customer) : [nextCustomer, ...customers];
    const currentNum = Number(draft.invoiceNum.replace(/\D/g, "")) || 1000;
    const nextNum = currentNum + 1;
    const nextDraft = createDraft(nextNum, settings);
    setCustomers(nextCustomers);
    setDraft(nextDraft);
    await writeJson(STORAGE_KEYS.customers, nextCustomers);
    await AsyncStorage.setItem(STORAGE_KEYS.invoiceNum, String(nextNum));
    await writeJson(STORAGE_KEYS.draft, nextDraft);
    return { ok: true, message: `${draft.invoiceNum} saved for ${name}.`, customer: nextCustomer };
  }, [customers, draft, settings, totals]);

  const saveCustomerProfile = useCallback(async (customer) => {
    const existing = customers.find((item) => item.id === customer.id);
    const nextCustomer: Customer = existing ? { ...existing, ...customer } : {
      ...customer,
      orders: [],
      totalSpent: 0,
      lastSeen: "",
      createdAt: today(),
    };
    const nextCustomers = existing ? customers.map((item) => item.id === customer.id ? nextCustomer : item) : [nextCustomer, ...customers];
    setCustomers(nextCustomers);
    await writeJson(STORAGE_KEYS.customers, nextCustomers);
  }, [customers]);

  const deleteCustomer = useCallback(async (id: string) => {
    const nextCustomers = customers.filter((customer) => customer.id !== id);
    setCustomers(nextCustomers);
    await writeJson(STORAGE_KEYS.customers, nextCustomers);
  }, [customers]);

  const loadCustomerIntoDraft = useCallback((customer: Customer) => {
    updateDraft({
      customerName: customer.name,
      customerPhone: customer.phone,
      customerCity: customer.city,
      customerAddress: customer.address,
    });
  }, [updateDraft]);

  const value: BillingContextValue = {
    products,
    customers,
    draft,
    settings,
    isReady,
    isSyncing,
    catalogStatus,
    totals,
    stats,
    updateDraft,
    updateSettings,
    syncProducts,
    addProduct,
    addItem,
    updateQty,
    removeItem,
    clearDraft,
    saveBill,
    saveCustomerProfile,
    deleteCustomer,
    loadCustomerIntoDraft,
  };

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) throw new Error("useBilling must be used within BillingProvider");
  return context;
}

export function formatCurrency(value: number) {
  return `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
}

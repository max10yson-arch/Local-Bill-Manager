import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ProductCategory = "Saree" | "Bedsheet" | "Custom";

export type Product = {
  id: string;
  name: string;
  price: number;
  category: ProductCategory;
  discount?: number;
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
  productDiscount: number;
  billDiscount: number;
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

export type BillListItem = Order & {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
};

export type EditingBill = { customerId: string; orderId: string } | null;

export type Totals = {
  subtotal: number;
  productDiscount: number;
  billDiscount: number;
  discount: number;
  taxable: number;
  gst: number;
  delivery: number;
  grand: number;
};

type BillingContextValue = {
  products: Product[];
  customers: Customer[];
  allBills: BillListItem[];
  draft: BillDraft;
  settings: StoreSettings;
  editingBill: EditingBill;
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
  loadBillForEditing: (customer: Customer, order: Order) => void;
  deleteBill: (customerId: string, orderId: string) => Promise<void>;
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
  { id: "saree_silk_001", name: "Banarasi Silk Saree", price: 5490, discount: 0, category: "Saree" },
  { id: "saree_cotton_002", name: "Soft Cotton Saree", price: 1890, discount: 0, category: "Saree" },
  { id: "saree_kalamkari_003", name: "Printed Kalamkari Saree", price: 2590, discount: 10, category: "Saree" },
  { id: "saree_party_004", name: "Party Wear Saree", price: 3290, discount: 5, category: "Saree" },
  { id: "bedsheet_king_001", name: "King Size Cotton Bedsheet", price: 1290, discount: 0, category: "Bedsheet" },
  { id: "bedsheet_double_002", name: "Double Bed Floral Bedsheet", price: 990, discount: 0, category: "Bedsheet" },
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

function parseDiscount(value: unknown) {
  const discount = Number(value || 0);
  if (Number.isNaN(discount)) return 0;
  return Math.max(0, Math.min(100, discount));
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

export function calculateTotals(draft: BillDraft): Totals {
  const subtotal = draft.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const productDiscount = draft.items.reduce((sum, item) => sum + item.price * item.qty * Math.max(0, item.discount || 0) / 100, 0);
  const afterProductDiscount = Math.max(0, subtotal - productDiscount);
  const billDiscount = afterProductDiscount * Math.max(0, draft.discountRate || 0) / 100;
  const taxable = Math.max(0, afterProductDiscount - billDiscount);
  const gst = taxable * Math.max(0, draft.gstRate || 0) / 100;
  const delivery = Math.max(0, draft.delivery || 0);
  const grand = taxable + gst + delivery;
  return { subtotal, productDiscount, billDiscount, discount: productDiscount + billDiscount, taxable, gst, delivery, grand };
}

function createOrderFromDraft(draft: BillDraft, totals: Totals, id?: string): Order {
  return {
    id: id || makeId("order"),
    invoiceNum: draft.invoiceNum,
    date: draft.date || today(),
    items: draft.items,
    subtotal: totals.subtotal,
    productDiscount: totals.productDiscount,
    billDiscount: totals.billDiscount,
    discount: totals.discount,
    gst: totals.gst,
    delivery: totals.delivery,
    grand: totals.grand,
    notes: draft.notes,
  };
}

function normalizeCustomer(customer: Customer): Customer {
  const totalSpent = customer.orders.reduce((sum, order) => sum + order.grand, 0);
  const lastSeen = customer.orders[0]?.date || "";
  return { ...customer, totalSpent, lastSeen };
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
  const [editingBill, setEditingBill] = useState<EditingBill>(null);
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
      setCustomers(savedCustomers.map(normalizeCustomer));
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

  const allBills = useMemo(() => customers.flatMap((customer) => customer.orders.map((order) => ({
    ...order,
    productDiscount: order.productDiscount ?? 0,
    billDiscount: order.billDiscount ?? order.discount ?? 0,
    discount: order.discount ?? 0,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerCity: customer.city,
    customerAddress: customer.address,
  }))).sort((a, b) => `${b.date}${b.invoiceNum}`.localeCompare(`${a.date}${a.invoiceNum}`)), [customers]);

  const stats = useMemo(() => {
    const orderCount = customers.reduce((sum, customer) => sum + customer.orders.length, 0);
    const totalRevenue = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);
    const topCustomer = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];
    return { customerCount: customers.length, orderCount, totalRevenue, averageOrder: orderCount ? totalRevenue / orderCount : 0, topCustomer };
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
        ...((data?.products?.sarees ?? []).filter(live).map((item: { id?: string; name?: string; price?: unknown; discount?: unknown }) => ({
          id: item.id || makeId("saree"),
          name: item.name || "Unnamed Saree",
          price: parsePrice(item.price),
          discount: parseDiscount(item.discount),
          category: "Saree" as const,
        }))),
        ...((data?.products?.bedsheets ?? []).filter(live).map((item: { id?: string; name?: string; price?: unknown; discount?: unknown }) => ({
          id: item.id || makeId("bedsheet"),
          name: item.name || "Unnamed Bedsheet",
          price: parsePrice(item.price),
          discount: parseDiscount(item.discount),
          category: "Bedsheet" as const,
        }))),
      ].filter((item) => item.price > 0);
      if (!remoteProducts.length) throw new Error("Catalog has no live products");
      setProducts(remoteProducts);
      await writeJson(STORAGE_KEYS.products, remoteProducts);
      setCatalogStatus(`${remoteProducts.length} products synced from catalog with discounts`);
    } catch {
      setCatalogStatus(`${products.length} offline products available`);
    } finally {
      setIsSyncing(false);
    }
  }, [products.length]);

  const addProduct = useCallback(async (product: Omit<Product, "id">) => {
    const next = [{ id: makeId("product"), discount: 0, ...product }, ...products];
    setProducts(next);
    await writeJson(STORAGE_KEYS.products, next);
    setCatalogStatus(`${next.length} products available offline`);
  }, [products]);

  const addItem = useCallback((product: Product) => {
    setDraft((current) => {
      const existing = current.items.find((item) => item.id === product.id && item.category === product.category);
      const items = existing
        ? current.items.map((item) => item.uid === existing.uid ? { ...item, qty: item.qty + 1 } : item)
        : [{ ...product, discount: product.discount || 0, uid: makeId("item"), qty: 1 }, ...current.items];
      return { ...current, items };
    });
  }, []);

  const updateQty = useCallback((uid: string, qty: number) => {
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.uid === uid ? { ...item, qty: Math.max(1, qty || 1) } : item) }));
  }, []);

  const removeItem = useCallback((uid: string) => {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.uid !== uid) }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(createDraft(Number(draft.invoiceNum.replace(/\D/g, "")) || 1000, settings));
    setEditingBill(null);
  }, [draft.invoiceNum, settings]);

  const saveBill = useCallback(async () => {
    if (!draft.customerName.trim()) return { ok: false, message: "Customer name is required." };
    if (!draft.items.length) return { ok: false, message: "Add at least one product." };
    const phone = draft.customerPhone.trim();
    const name = draft.customerName.trim();
    const order = createOrderFromDraft(draft, totals, editingBill?.orderId);
    let workingCustomers = customers.map((customer) => editingBill && customer.id === editingBill.customerId ? { ...customer, orders: customer.orders.filter((item) => item.id !== editingBill.orderId) } : customer);
    const existing = workingCustomers.find((customer) => phone ? customer.phone === phone : customer.name.toLowerCase() === name.toLowerCase());
    const nextCustomer: Customer = existing ? normalizeCustomer({ ...existing, name, phone, city: draft.customerCity, address: draft.customerAddress, orders: [order, ...existing.orders] }) : normalizeCustomer({ id: makeId("customer"), name, phone, city: draft.customerCity, address: draft.customerAddress, orders: [order], totalSpent: 0, lastSeen: order.date, createdAt: today() });
    let nextCustomers = existing ? workingCustomers.map((customer) => customer.id === existing.id ? nextCustomer : normalizeCustomer(customer)) : [nextCustomer, ...workingCustomers.map(normalizeCustomer)];
    nextCustomers = nextCustomers.filter((customer) => customer.orders.length || customer.name.trim());
    const currentNum = Number(draft.invoiceNum.replace(/\D/g, "")) || 1000;
    const nextNum = Math.max(currentNum + 1, Number(await AsyncStorage.getItem(STORAGE_KEYS.invoiceNum) || "1000") + 1);
    const nextDraft = createDraft(nextNum, settings);
    setCustomers(nextCustomers);
    setDraft(nextDraft);
    setEditingBill(null);
    await writeJson(STORAGE_KEYS.customers, nextCustomers);
    if (!editingBill) await AsyncStorage.setItem(STORAGE_KEYS.invoiceNum, String(nextNum));
    await writeJson(STORAGE_KEYS.draft, nextDraft);
    return { ok: true, message: editingBill ? `${draft.invoiceNum} updated for ${name}.` : `${draft.invoiceNum} saved for ${name}.`, customer: nextCustomer };
  }, [customers, draft, editingBill, settings, totals]);

  const saveCustomerProfile = useCallback(async (customer) => {
    const existing = customers.find((item) => item.id === customer.id);
    const nextCustomer: Customer = existing ? normalizeCustomer({ ...existing, ...customer }) : normalizeCustomer({ ...customer, orders: [], totalSpent: 0, lastSeen: "", createdAt: today() });
    const nextCustomers = existing ? customers.map((item) => item.id === customer.id ? nextCustomer : item) : [nextCustomer, ...customers];
    setCustomers(nextCustomers);
    await writeJson(STORAGE_KEYS.customers, nextCustomers);
  }, [customers]);

  const deleteCustomer = useCallback(async (id: string) => {
    const nextCustomers = customers.filter((customer) => customer.id !== id);
    setCustomers(nextCustomers);
    await writeJson(STORAGE_KEYS.customers, nextCustomers);
  }, [customers]);

  const deleteBill = useCallback(async (customerId: string, orderId: string) => {
    const nextCustomers = customers.map((customer) => customer.id === customerId ? normalizeCustomer({ ...customer, orders: customer.orders.filter((order) => order.id !== orderId) }) : customer).filter((customer) => customer.orders.length || customer.name.trim());
    setCustomers(nextCustomers);
    if (editingBill?.orderId === orderId) setEditingBill(null);
    await writeJson(STORAGE_KEYS.customers, nextCustomers);
  }, [customers, editingBill]);

  const loadCustomerIntoDraft = useCallback((customer: Customer) => {
    updateDraft({ customerName: customer.name, customerPhone: customer.phone, customerCity: customer.city, customerAddress: customer.address });
  }, [updateDraft]);

  const loadBillForEditing = useCallback((customer: Customer, order: Order) => {
    const productDiscount = order.productDiscount ?? 0;
    const billDiscount = order.billDiscount ?? Math.max(0, (order.discount || 0) - productDiscount);
    const taxable = Math.max(0, order.subtotal - productDiscount - billDiscount);
    setDraft({ invoiceNum: order.invoiceNum, date: order.date, customerName: customer.name, customerPhone: customer.phone, customerCity: customer.city, customerAddress: customer.address, gstRate: taxable ? Math.round((order.gst / taxable) * 10000) / 100 : settings.defaultGst, discountRate: 0, delivery: order.delivery, notes: order.notes, items: order.items });
    setEditingBill({ customerId: customer.id, orderId: order.id });
  }, [settings.defaultGst]);

  const value: BillingContextValue = { products, customers, allBills, draft, settings, editingBill, isReady, isSyncing, catalogStatus, totals, stats, updateDraft, updateSettings, syncProducts, addProduct, addItem, updateQty, removeItem, clearDraft, saveBill, saveCustomerProfile, deleteCustomer, loadCustomerIntoDraft, loadBillForEditing, deleteBill };

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

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  deleteRepoFile,
  getRepoFile,
  listRepoDirectory,
  parseJsonFromGitHubContent,
  putRepoBinaryBase64,
  putRepoFile,
} from "@/lib/githubContents";
import { parseTranslationsJs, serializeTranslationsJs } from "@/lib/translationsFormat";
import type { CatalogRoot, Product, ProductCategory, SiteConfig } from "@/types/sareeCatalog";

export type GitHubAuth = {
  username: string;
  repo: string;
  token: string;
};

const GITHUB_AUTH_KEY = "github_admin_auth";
const GITHUB_CACHED_DATA = "github_admin_catalog";

function cloneCatalog(c: CatalogRoot): CatalogRoot {
  return JSON.parse(JSON.stringify(c)) as CatalogRoot;
}

function normalizeCatalog(data: CatalogRoot): CatalogRoot {
  const out = cloneCatalog(data);
  out.products = out.products || { sarees: [], bedsheets: [] };
  out.products.sarees = out.products.sarees || [];
  out.products.bedsheets = out.products.bedsheets || [];
  out.site_config = out.site_config || {};
  return out;
}

function collectReferencedAssetPaths(catalog: CatalogRoot): Set<string> {
  const refs = new Set<string>();
  const add = (p: string | undefined) => {
    if (p && typeof p === "string" && p.startsWith("assets/")) refs.add(p);
  };
  for (const v of Object.values(catalog.site_config || {})) {
    if (typeof v === "string") add(v);
  }
  for (const cat of ["sarees", "bedsheets"] as const) {
    for (const p of catalog.products[cat] || []) {
      add(p.image);
      for (const m of p.more_images || []) add(m);
    }
  }
  return refs;
}

export function getDynamicAppStrings(catalog: CatalogRoot | null): string[] {
  if (!catalog) return [];
  const strings = new Set<string>();
  const textBaseKeys = [
    "hero_title",
    "hero_subtitle",
    "sarees_title",
    "sarees_subtitle",
    "bedsheets_title",
    "bedsheets_subtitle",
    "home_sarees_title",
    "home_sarees_subtitle",
    "home_bedsheets_title",
    "home_bedsheets_subtitle",
    "about_title",
    "about_subtitle",
    "about_f1_title",
    "about_f1_desc",
    "about_f2_title",
    "about_f2_desc",
    "about_f3_title",
    "about_f3_desc",
  ];
  const sc = catalog.site_config || {};
  for (const k of textBaseKeys) {
    const val = sc[k];
    if (val && typeof val === "string" && val.trim()) strings.add(val.trim());
  }
  for (const cat of ["sarees", "bedsheets"] as const) {
    for (const p of catalog.products[cat] || []) {
      if (p.name?.trim()) strings.add(p.name.trim());
      if (p.description?.trim()) strings.add(p.description.trim());
    }
  }
  return Array.from(strings);
}

export type GitHubAdminContextType = {
  auth: GitHubAuth | null;
  isAuthed: boolean;
  siteConfig: SiteConfig;
  products: { sarees: Product[]; bedsheets: Product[] };
  translations: Record<string, string>;
  loading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  hasUnsavedTranslations: boolean;
  pendingDeleteCount: number;
  login: (username: string, repo: string, token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  addProduct: (category: ProductCategory, data: Partial<Product>) => Promise<void>;
  editProduct: (category: ProductCategory, id: string, patch: Partial<Product>) => Promise<void>;
  deleteProduct: (category: ProductCategory, id: string) => Promise<void>;
  reorderProducts: (category: ProductCategory, newOrderIds: string[]) => Promise<void>;
  bulkAction: (category: ProductCategory, ids: string[], action: string) => Promise<void>;
  updateConfig: (patch: Partial<SiteConfig>) => void;
  uploadConfigImage: (key: keyof SiteConfig, localUri: string) => Promise<string>;
  uploadProductImage: (category: ProductCategory, localUri: string) => Promise<string>;
  deleteImage: (path: string) => Promise<void>;
  /** Resolve SHAs and queue orphan asset files for deletion on next commit. */
  queueOrphanDeletes: (paths: string[]) => Promise<void>;
  /** List image paths under assets/* that are not referenced by catalog. */
  listOrphanImageCandidates: () => Promise<string[]>;
  commitChanges: (message: string) => Promise<void>;
  diff: () => string;
  setTranslation: (key: string, value: string) => void;
  addTranslationRow: (key: string, value: string) => void;
  removeTranslation: (key: string) => void;
  getPagesBaseUrl: () => string;
};

const GitHubAdminContext = createContext<GitHubAdminContextType>(null as never);

async function loadTranslationsFromRepo(
  username: string,
  repo: string,
  token: string,
): Promise<{ data: Record<string, string>; sha: string | null; raw: string }> {
  const f = await getRepoFile(username, repo, "translations.js", token);
  if (!f) return { data: {}, sha: null, raw: "" };
  const data = parseTranslationsJs(f.text);
  return { data, sha: f.sha, raw: f.text };
}

export const GitHubAdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<GitHubAuth | null>(null);
  const [catalog, setCatalog] = useState<CatalogRoot | null>(null);
  const [dataJsonSha, setDataJsonSha] = useState("");
  const [originalCatalogJson, setOriginalCatalogJson] = useState("");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translationsFileSha, setTranslationsFileSha] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasUnsavedTranslations, setHasUnsavedTranslations] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalogRef = useRef<CatalogRoot | null>(null);
  const authRef = useRef<GitHubAuth | null>(null);
  const dataJsonShaRef = useRef("");
  const translationsFileShaRef = useRef<string | null>(null);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);
  useEffect(() => {
    dataJsonShaRef.current = dataJsonSha;
  }, [dataJsonSha]);
  useEffect(() => {
    translationsFileShaRef.current = translationsFileSha;
  }, [translationsFileSha]);

  const markCatalogDirty = useCallback(() => setHasUnsavedChanges(true), []);

  const loadCatalogFromNetwork = useCallback(
    async (a: GitHubAuth) => {
      const url = `https://api.github.com/repos/${a.username}/${a.repo}/contents/data.json?t=${Date.now()}`;
      const res = await fetch(url, {
        headers: { Authorization: `token ${a.token}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not fetch data.json");
      const json = (await res.json()) as { content: string; sha: string };
      const data = parseJsonFromGitHubContent(json.content) as CatalogRoot;
      const norm = normalizeCatalog(data);
      setDataJsonSha(json.sha);
      setCatalog(norm);
      const serialized = JSON.stringify(norm, null, 2);
      setOriginalCatalogJson(serialized);
      setHasUnsavedChanges(false);
      await AsyncStorage.setItem(GITHUB_CACHED_DATA, serialized);

      const tr = await loadTranslationsFromRepo(a.username, a.repo, a.token);
      setTranslations(tr.data);
      setTranslationsFileSha(tr.sha);
      setHasUnsavedTranslations(false);

      setPendingDeletes(new Map());
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const creds = await AsyncStorage.getItem(GITHUB_AUTH_KEY);
      if (!creds) return;
      const parsed = JSON.parse(creds) as GitHubAuth;
      setAuth(parsed);

      // Try to load cached data first for immediate UI
      const cached = await AsyncStorage.getItem(GITHUB_CACHED_DATA);
      if (cached) {
        try {
          const data = JSON.parse(cached) as CatalogRoot;
          const norm = normalizeCatalog(data);
          setCatalog(norm);
          setOriginalCatalogJson(cached);
        } catch (e) {
          console.warn("Failed to parse cached catalog", e);
        }
      }

      setLoading(true);
      try {
        await loadCatalogFromNetwork(parsed);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to restore session");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCatalogFromNetwork]);

  const login = async (username: string, repo: string, token: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const a = { username: username.trim(), repo: repo.trim(), token: token.trim() };
      await loadCatalogFromNetwork(a);
      setAuth(a);
      await AsyncStorage.setItem(GITHUB_AUTH_KEY, JSON.stringify(a));
      setLoading(false);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to authenticate.");
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    setAuth(null);
    setCatalog(null);
    setDataJsonSha("");
    setOriginalCatalogJson("");
    setTranslations({});
    setTranslationsFileSha(null);
    setHasUnsavedChanges(false);
    setHasUnsavedTranslations(false);
    setPendingDeletes(new Map());
    await AsyncStorage.removeItem(GITHUB_AUTH_KEY);
    await AsyncStorage.removeItem(GITHUB_CACHED_DATA);
  };

  const refreshCatalog = async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      await loadCatalogFromNetwork(auth);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch catalog");
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = useCallback(
    (patch: Partial<SiteConfig>) => {
      setCatalog((c) => {
        if (!c) return c;
        return { ...c, site_config: { ...c.site_config, ...patch } };
      });
      markCatalogDirty();
    },
    [markCatalogDirty],
  );

  const compressUploadPath = async (
    localUri: string,
    destPath: string,
  ): Promise<string> => {
    const a = authRef.current;
    if (!a) throw new Error("Not authenticated");
    const manipulated = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1600 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.WEBP },
    );
    const b64 = await FileSystem.readAsStringAsync(manipulated.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const existing = await getRepoFile(a.username, a.repo, destPath, a.token);
    const existingSha = existing?.sha ?? null;
    await putRepoBinaryBase64(
      a.username,
      a.repo,
      destPath,
      a.token,
      b64,
      existingSha,
      `Upload image ${destPath}`,
    );
    return destPath;
  };

  const uploadConfigImage = async (key: keyof SiteConfig, localUri: string): Promise<string> => {
    const safe = `${Date.now()}_banner.webp`;
    const path = `assets/banners/${safe}`;
    const url = await compressUploadPath(localUri, path);
    updateConfig({ [key]: url } as Partial<SiteConfig>);
    return url;
  };

  const uploadProductImage = async (category: ProductCategory, localUri: string): Promise<string> => {
    const safe = `${Date.now()}_img.webp`;
    const path = `assets/${category}/${safe}`;
    return compressUploadPath(localUri, path);
  };

  const deleteImage = async (path: string): Promise<void> => {
    const a = authRef.current;
    if (!a) return;
    const f = await getRepoFile(a.username, a.repo, path, a.token);
    if (!f) return;
    setPendingDeletes((m) => new Map(m).set(path, f.sha));
  };

  const queueOrphanDeletes = async (paths: string[]): Promise<void> => {
    const a = authRef.current;
    if (!a) return;
    for (const path of paths) {
      const f = await getRepoFile(a.username, a.repo, path, a.token);
      if (f) setPendingDeletes((m) => new Map(m).set(path, f.sha));
    }
  };

  const listOrphanImageCandidates = async (): Promise<string[]> => {
    const a = authRef.current;
    const c = catalogRef.current;
    if (!a || !c) return [];
    const refs = collectReferencedAssetPaths(c);
    const dirs = ["assets/sarees", "assets/bedsheets", "assets/banners"];
    const orphans: string[] = [];
    for (const d of dirs) {
      try {
        const entries = await listRepoDirectory(a.username, a.repo, d, a.token);
        for (const e of entries) {
          if (e.type === "file") {
            const full = `${d}/${e.name}`;
            if (!refs.has(full)) orphans.push(full);
          }
        }
      } catch {
        /* directory may not exist */
      }
    }
    return orphans;
  };

  const addProduct = async (category: ProductCategory, data: Partial<Product>): Promise<void> => {
    setCatalog((c) => {
      if (!c) return c;
      const id = data.id ?? `p${Date.now()}`;
      const product: Product = {
        id,
        name: data.name ?? "New product",
        price: data.price ?? "₹0",
        image: data.image ?? "",
        style: data.style ?? "",
        stock: data.stock ?? 0,
        discount: data.discount ?? 0,
        badge: data.badge ?? "",
        description: data.description ?? "",
        status: data.status ?? "live",
        more_images: data.more_images ?? [],
        dateAdded: data.dateAdded ?? new Date().toISOString(),
      };
      const list = [...c.products[category], product];
      return { ...c, products: { ...c.products, [category]: list } };
    });
    markCatalogDirty();
  };

  const editProduct = async (
    category: ProductCategory,
    id: string,
    patch: Partial<Product>,
  ): Promise<void> => {
    setCatalog((c) => {
      if (!c) return c;
      const list = c.products[category].map((p) => (p.id === id ? { ...p, ...patch } : p));
      return { ...c, products: { ...c.products, [category]: list } };
    });
    markCatalogDirty();
  };

  const deleteProduct = async (category: ProductCategory, id: string): Promise<void> => {
    const a = authRef.current;
    const c = catalogRef.current;
    if (!a || !c) return;
    const prod = c.products[category].find((p) => p.id === id);
    if (prod) {
      const imgs = [prod.image, ...(prod.more_images || [])].filter(Boolean) as string[];
      for (const img of imgs) {
        const f = await getRepoFile(a.username, a.repo, img, a.token);
        if (f) setPendingDeletes((m) => new Map(m).set(img, f.sha));
      }
    }
    setCatalog((c) => {
      if (!c) return c;
      const list = c.products[category].filter((p) => p.id !== id);
      return { ...c, products: { ...c.products, [category]: list } };
    });
    markCatalogDirty();
  };

  const reorderProducts = async (category: ProductCategory, newOrderIds: string[]): Promise<void> => {
    setCatalog((c) => {
      if (!c) return c;
      const byId = new Map(c.products[category].map((p) => [p.id, p] as const));
      const list = newOrderIds.map((id) => byId.get(id)).filter(Boolean) as Product[];
      return { ...c, products: { ...c.products, [category]: list } };
    });
    markCatalogDirty();
  };

  const applyBulk = (products: Product[], ids: Set<string>, action: string): Product[] => {
    return products.map((p) => {
      if (!ids.has(p.id)) return p;
      const next = { ...p };
      if (action === "delete") return p;
      if (action === "set_live") next.status = "live";
      else if (action === "set_hidden") next.status = "hidden";
      else if (action === "set_archived") next.status = "archived";
      else if (action === "discount_10") next.discount = 10;
      else if (action === "discount_20") next.discount = 20;
      else if (action === "discount_25") next.discount = 25;
      else if (action === "discount_50") next.discount = 50;
      else if (action === "remove_discount") next.discount = 0;
      else if (action === "set_badge_new") next.badge = "new";
      else if (action === "set_badge_sale") next.badge = "sale";
      else if (action === "set_badge_trending") next.badge = "trending";
      else if (action === "remove_badge") next.badge = "";
      else if (action === "set_stock_zero") next.stock = 0;
      return next;
    });
  };

  const bulkAction = async (category: ProductCategory, ids: string[], action: string): Promise<void> => {
    if (!authRef.current) return;
    const idSet = new Set(ids);
    if (action === "delete") {
      for (const id of ids) {
        await deleteProduct(category, id);
      }
      return;
    }
    setCatalog((c) => {
      if (!c) return c;
      const list = applyBulk(c.products[category], idSet, action);
      return { ...c, products: { ...c.products, [category]: list } };
    });
    markCatalogDirty();
  };

  const setTranslation = useCallback((key: string, value: string) => {
    setTranslations((t) => ({ ...t, [key]: value }));
    setHasUnsavedTranslations(true);
  }, []);

  const addTranslationRow = useCallback((key: string, value: string) => {
    setTranslations((t) => ({ ...t, [key]: value }));
    setHasUnsavedTranslations(true);
  }, []);

  const removeTranslation = useCallback((key: string) => {
    setTranslations((t) => {
      const n = { ...t };
      delete n[key];
      return n;
    });
    setHasUnsavedTranslations(true);
  }, []);

  const commitChanges = async (message: string): Promise<void> => {
    const a = authRef.current;
    const cat = catalogRef.current;
    if (!a) throw new Error("Not authenticated");
    const userMsg = message.trim() || "Update catalog from mobile admin";

    if (hasUnsavedChanges && cat) {
      const text = JSON.stringify(cat, null, 2);
      const newSha = await putRepoFile(
        a.username,
        a.repo,
        "data.json",
        a.token,
        text,
        dataJsonShaRef.current,
        userMsg,
      );
      setDataJsonSha(newSha || dataJsonShaRef.current);
      setOriginalCatalogJson(text);
      setHasUnsavedChanges(false);
    }

    const deletesSnapshot = new Map(pendingDeletes);
    for (const [path, sha] of deletesSnapshot) {
      await deleteRepoFile(a.username, a.repo, path, a.token, sha, `${userMsg} (delete ${path})`);
    }
    setPendingDeletes(new Map());

    if (hasUnsavedTranslations) {
      const trText = serializeTranslationsJs(translations);
      const newSha = await putRepoFile(
        a.username,
        a.repo,
        "translations.js",
        a.token,
        trText,
        translationsFileShaRef.current,
        `${userMsg} (translations)`,
      );
      setTranslationsFileSha(newSha || translationsFileShaRef.current);
      setHasUnsavedTranslations(false);
    }
  };

  const diff = (): string => {
    if (!catalog) return "";
    const now = JSON.stringify(catalog, null, 2);
    if (now === originalCatalogJson) return "No catalog JSON changes.";
    return "Catalog JSON has been modified (diff omitted for size).";
  };

  const getPagesBaseUrl = (): string => {
    if (!auth) return "";
    return `https://${auth.username}.github.io/${auth.repo}/`;
  };

  const siteConfig = catalog?.site_config ?? {};
  const products = catalog?.products ?? { sarees: [], bedsheets: [] };

  const value: GitHubAdminContextType = {
    auth,
    isAuthed: !!auth,
    siteConfig,
    products,
    translations,
    loading,
    error,
    hasUnsavedChanges: hasUnsavedChanges || pendingDeletes.size > 0,
    hasUnsavedTranslations,
    pendingDeleteCount: pendingDeletes.size,
    login,
    logout,
    refreshCatalog,
    addProduct,
    editProduct,
    deleteProduct,
    reorderProducts,
    bulkAction,
    updateConfig,
    uploadConfigImage,
    uploadProductImage,
    deleteImage,
    queueOrphanDeletes,
    listOrphanImageCandidates,
    commitChanges,
    diff,
    setTranslation,
    addTranslationRow,
    removeTranslation,
    getPagesBaseUrl,
  };

  return <GitHubAdminContext.Provider value={value}>{children}</GitHubAdminContext.Provider>;
};

export function useGitHubAdmin() {
  return useContext(GitHubAdminContext);
}

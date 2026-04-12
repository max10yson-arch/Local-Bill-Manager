import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type GitHubAuth = {
  username: string;
  repo: string;
  token: string;
};

export type GitHubAdminContextType = {
  auth: GitHubAuth | null;
  isAuthed: boolean;
  siteConfig: any;
  products: {
    sarees: any[];
    bedsheets: any[];
  };
  loading: boolean;
  error: string | null;
  login: (username: string, repo: string, token: string) => Promise<boolean>;
  logout: () => void;
  refreshCatalog: () => Promise<void>;
  addProduct: (category: "sarees" | "bedsheets", data: any) => Promise<void>;
  editProduct: (category: "sarees" | "bedsheets", id: string, patch: any) => Promise<void>;
  deleteProduct: (category: "sarees" | "bedsheets", id: string) => Promise<void>;
  reorderProducts: (category: "sarees" | "bedsheets", newOrder: string[]) => Promise<void>;
  bulkAction: (category:"sarees"|"bedsheets", ids: string[], action: string) => Promise<void>;
  updateConfig: (patch: any) => Promise<void>;
  uploadConfigImage: (key: string, file: any) => Promise<string>;
  uploadProductImage: (category: string, file: any) => Promise<string>;
  deleteImage: (path: string) => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
  diff: () => Promise<string>;
};

const GitHubAdminContext = createContext<GitHubAdminContextType>(null as any);

const GITHUB_AUTH_KEY = "github_admin_auth";
const GITHUB_CACHED_DATA = "github_admin_catalog";

export const GitHubAdminProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [auth, setAuth] = useState<GitHubAuth|null>(null);
  const [siteConfig, setSiteConfig] = useState<any>({});
  const [products, setProducts] = useState<{sarees:any[],bedsheets:any[]}>({ sarees:[], bedsheets:[] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const isAuthed = !!auth;
  useEffect(() => {
    (async () => {
      const creds = await AsyncStorage.getItem(GITHUB_AUTH_KEY);
      if (creds) setAuth(JSON.parse(creds));
    })();
  }, []);
  const login = async (username: string, repo: string, token: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${username}/${repo}/contents/data.json`, {
        headers: { Authorization: `token ${token}` }
      });
      if (!res.ok) throw new Error("Bad credentials or repo misnamed");
      const json = await res.json();
      const text = decodeURIComponent(escape(atob(json.content.replace(/\s/g,''))));
      const data = JSON.parse(text);
      setAuth({ username, repo, token });
      await AsyncStorage.setItem(GITHUB_AUTH_KEY, JSON.stringify({ username, repo, token }));
      setSiteConfig(data.site_config || {});
      setProducts({ sarees: data.products?.sarees ?? [], bedsheets: data.products?.bedsheets ?? [] });
      await AsyncStorage.setItem(GITHUB_CACHED_DATA, JSON.stringify(data));
      setLoading(false);
      return true;
    } catch(e:any) {
      setError(e.message || "Failed to authenticate.");
      setLoading(false);
      return false;
    }
  };
  const logout = async () => {
    setAuth(null);
    setProducts({ sarees:[], bedsheets:[] });
    setSiteConfig({});
    await AsyncStorage.removeItem(GITHUB_AUTH_KEY);
    await AsyncStorage.removeItem(GITHUB_CACHED_DATA);
  };
  const refreshCatalog = async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${auth.username}/${auth.repo}/contents/data.json`, {
        headers: { Authorization: `token ${auth.token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch catalog");
      const json = await res.json();
      const text = decodeURIComponent(escape(atob(json.content.replace(/\s/g,''))));
      const data = JSON.parse(text);
      setSiteConfig(data.site_config || {});
      setProducts({ sarees: data.products?.sarees ?? [], bedsheets: data.products?.bedsheets ?? [] });
      await AsyncStorage.setItem(GITHUB_CACHED_DATA, JSON.stringify(data));
      setLoading(false);
    } catch(e:any){
      setError(e.message);
      setLoading(false);
    }
  };
  const addProduct = async (category:"sarees"|"bedsheets", data:any) => {};
  const editProduct = async (category, id, patch) => {};
  const deleteProduct = async (category, id) => {};
  const reorderProducts = async (category, newOrder) => {};
  const bulkAction = async (category, ids, action) => {};
  const updateConfig = async (patch) => {};
  const uploadConfigImage = async (key, file) => { return ""; };
  const uploadProductImage = async (category, file) => { return ""; };
  const deleteImage = async (path: string) => {};
  const commitChanges = async (msg: string) => {};
  const diff = async () => "";
  return (
    <GitHubAdminContext.Provider
      value={{
        auth, isAuthed, loading, error,
        siteConfig, products,
        login, logout, refreshCatalog,
        addProduct, editProduct, deleteProduct,
        reorderProducts, bulkAction,
        updateConfig, uploadConfigImage,
        uploadProductImage, deleteImage,
        commitChanges, diff
      }}
    >{children}</GitHubAdminContext.Provider>
  );
};
export function useGitHubAdmin() {
  return useContext(GitHubAdminContext);
}
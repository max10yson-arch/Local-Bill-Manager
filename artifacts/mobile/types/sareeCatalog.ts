export type ProductStatus = "live" | "hidden" | "archived" | "" | undefined;

export type ProductBadge = "new" | "sale" | "trending" | "" | undefined;

export interface Product {
  id: string;
  name: string;
  price: string;
  image: string;
  style?: string;
  stock: number;
  discount: number;
  badge?: ProductBadge;
  description: string;
  status?: ProductStatus;
  more_images?: string[];
  dateAdded?: string;
}

export interface SiteConfig {
  hero_cover?: string;
  sarees_cover?: string;
  bedsheets_cover?: string;
  hero_title?: string;
  hero_subtitle?: string;
  sarees_title?: string;
  sarees_subtitle?: string;
  bedsheets_title?: string;
  bedsheets_subtitle?: string;
  home_sarees_cover?: string;
  home_sarees_title?: string;
  home_sarees_subtitle?: string;
  home_bedsheets_cover?: string;
  home_bedsheets_title?: string;
  home_bedsheets_subtitle?: string;
  delivery_value?: string;
  whatsapp_number?: string;
  about_title?: string;
  about_subtitle?: string;
  about_f1_title?: string;
  about_f1_desc?: string;
  about_f2_title?: string;
  about_f2_desc?: string;
  about_f3_title?: string;
  about_f3_desc?: string;
  [key: string]: unknown;
}

export interface CatalogRoot {
  site_config: SiteConfig;
  products: {
    sarees: Product[];
    bedsheets: Product[];
  };
}

export type ProductCategory = "sarees" | "bedsheets";

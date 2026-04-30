export type ProductStatusInput = "active" | "inactive" | "draft" | "deleted";
export type ProductVariantKindInput = "default" | "generated";

export interface ProductRequestInput {
  product_name: string;
  default_variant_sku?: string;
  unit?: string;
  image_url?: string | null;
  status?: ProductStatusInput;
  description?: string;
  created_at?: string | Date;
  category_id?: number | null;
  category?: string | null;
  base_price?: number | string | null;
  cogs?: number | string | null;
  attributes?: {
    name: string;
    values: string[];
  }[];
  variants?: {
    sku: string;
    name?: string;
    kind?: ProductVariantKindInput;
    selling_price?: number | string;
    price?: number | string;
    cogs?: number | string | null;
    image_url?: string | null;
    combinations?: string[];
  }[];
}

export interface ProductInput {
  product_name: string;
  default_variant_sku?: string | null;
  unit?: string;
  base_price?: number | null;
  cogs?: number | null;
  image_url?: string | null;
  status?: ProductStatusInput;
  description?: string;
  created_at?: string | Date;
  category_id: number | null;
  attributes: {
    name: string;
    values: string[];
  }[];
  variants: {
    sku: string;
    kind: ProductVariantKindInput;
    selling_price: number;
    cogs: number;
    image_url?: string | null;
    combinations: string[];
  }[];
}

export interface ProductCategoryItem {
  id: number;
  category_name: string;
}

export interface ProductCategoryRequestInput {
  category_name: string;
}

export interface BulkDeleteRequestInput {
  ids: number[];
}

export interface ProductImageCropRequestInput {
  image_url: string;
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type ProductParams = {
  id?: string;
};

export type ProductCategoryParams = {
  id?: string;
};

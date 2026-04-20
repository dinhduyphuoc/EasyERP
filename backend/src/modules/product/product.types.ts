export type ProductStatusInput = "active" | "inactive" | "draft" | "deleted";

export interface ProductRequestInput {
  product_name: string;
  sku?: string;
  unit?: string;
  image_url?: string;
  status?: ProductStatusInput;
  description?: string;
  createdAt?: string | Date;
  categoryId?: number | null;
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
    selling_price?: number | string;
    price?: number | string;
    cogs?: number | string | null;
    image_url?: string | null;
    combinations?: string[];
  }[];
}

export interface ProductInput {
  product_name: string;
  sku?: string;
  unit?: string;
  base_price?: number | null;
  cogs?: number | null;
  image_url?: string;
  status?: ProductStatusInput;
  description?: string;
  createdAt?: string | Date;
  categoryId: number | null;
  attributes: {
    name: string;
    values: string[];
  }[];
  variants: {
    sku: string;
    selling_price: number;
    cogs: number;
    image_url?: string;
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

export type ProductParams = {
  id?: string;
};

export type ProductCategoryParams = {
  id?: string;
};

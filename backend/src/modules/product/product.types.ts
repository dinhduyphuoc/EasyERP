export type ProductStatusInput = "active" | "inactive" | "draft" | "deleted";
export type ProductVariantKindInput = "default" | "generated";

export interface ProductRequestInput {
  spu_id?: number;
  spu_code?: string;
  spu?: string;
  default_variant_sku?: string;
  product_name: string;
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
    sku_code?: string;
    sku: string;
    name?: string;
    kind?: ProductVariantKindInput;
    selling_price?: number | string;
    price?: number | string;
    cogs?: number | string | null;
    image_url?: string | null;
    combinations?: string[];
    attribute_value_ids?: number[];
  }[];
}

export interface ProductInput {
  spu_id?: number;
  spu_code?: string | null;
  spu?: string | null;
  product_name: string;
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
    sku_code?: string;
    sku: string;
    kind: ProductVariantKindInput;
    selling_price: number;
    cogs: number;
    image_url?: string | null;
    combinations: string[];
    attribute_value_ids?: number[];
  }[];
}

export interface ProductCategoryItem {
  id: number;
  category_name: string;
}

export interface ProductCategoryRequestInput {
  category_name: string;
}

export interface ProductImportRowInput extends ProductRequestInput {
  row_no?: number;
  import_mode?: "upsert" | "create_only" | "update_only";
}

export interface ProductImportRequestInput {
  rows: ProductImportRowInput[];
}

export interface ProductImportResultItem {
  row_no: number;
  action: "created" | "updated";
  spu_id: number;
  spu: string | null;
  product_name: string;
}

export interface ProductListQuery {
  search?: string;
  status?: ProductStatusInput;
  category_id?: number;
  include_deleted?: boolean;
  page?: number;
  page_size?: number;
}

export interface ProductListResponseItem {
  id: number;
  spu_id: number;
  spu_code: string | null;
  spu: string | null;
  product_name: string;
  image_url: string | null;
  status: ProductStatusInput;
  category_id: number | null;
  min_price: string | null;
  max_price: string | null;
  variant_count: number;
  has_generated_variants: boolean;
  primary_variant: {
    sku_code: string;
    sku: string;
    kind: ProductVariantKindInput;
    selling_price: string;
    image_url: string | null;
  } | null;
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

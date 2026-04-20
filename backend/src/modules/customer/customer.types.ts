export type CustomerStatusInput = "active" | "inactive" | "deleted";

export interface CustomerListQuery {
  search?: string;
  status?: CustomerStatusInput;
  customer_category_id?: string;
}

export interface CustomerRequestInput {
  client_code?: string;
  full_name: string;
  phone: string;
  status?: "active" | "inactive";
  customer_category_id?: number | null;
}

export interface CustomerParams {
  id?: string;
}

export interface BulkDeleteRequestInput {
  ids: number[];
}

export interface CustomerCategoryItem {
  id: number;
  category_code: string | null;
  category_name: string;
  normalized_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationListQuery {
  state_id?: string;
  city_id?: string;
  is_active?: string;
}

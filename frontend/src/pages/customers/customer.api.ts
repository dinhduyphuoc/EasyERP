import { apiClient } from "@/api/api-client";

const ENDPOINT = "/customers";

export type CustomerCategory = {
  id: number;
  category_code: string | null;
  category_name: string;
  normalized_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerListItem = {
  id: number;
  client_code: string;
  full_name: string;
  phone: string;
  status: "active" | "inactive" | "deleted";
  created_at: string;
  updated_at: string;
  customer_category_id: number | null;
  customer_category: {
    id: number;
    category_code: string | null;
    category_name: string;
  } | null;
  last_purchased_at: string | null;
};

export type CustomerCreatePayload = {
  client_code?: string;
  full_name: string;
  phone: string;
  status?: "active" | "inactive";
  customer_category_id?: number | null;
};

type BulkDeletePayload = {
  ids: number[];
};

export type CustomerBulkDeleteResult = {
  deleted_ids: number[];
};

export const customerApi = {
  getCustomers: async (params?: Record<string, unknown>): Promise<CustomerListItem[]> => {
    return apiClient.get(ENDPOINT, { params });
  },

  getCustomerCategories: async (): Promise<CustomerCategory[]> => {
    return apiClient.get(`${ENDPOINT}/categories`);
  },

  createCustomer: async (data: CustomerCreatePayload): Promise<CustomerListItem> => {
    return apiClient.post(ENDPOINT, data);
  },

  deleteCustomers: async (ids: number[]): Promise<CustomerBulkDeleteResult> => {
    return apiClient.delete(ENDPOINT, { data: { ids } satisfies BulkDeletePayload });
  },
};

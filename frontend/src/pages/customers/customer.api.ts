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
  email: string | null;
  birth_date: string | null;
  gender: "male" | "female" | "other" | null;
  tax_code: string | null;
  status: "active" | "inactive" | "soft_deleted" | "deleted";
  created_at: string;
  updated_at: string;
  customer_category_id: number | null;
  customer_category: {
    id: number;
    category_code: string | null;
    category_name: string;
  } | null;
  addresses: Array<{
    id: number;
    type: "billing" | "shipping" | "office" | "warehouse" | "other";
    label: string | null;
    is_default: boolean;
    recipient_name: string | null;
    recipient_phone: string | null;
    note: string | null;
    address: {
      id: number;
      state_id: number;
      city_id: number;
      district_id: number | null;
      address_line: string;
      address_line2: string | null;
      state_name: string;
      city_name: string;
      district_name: string | null;
      postal_code: string | null;
      country_code: string;
      latitude: string | null;
      longitude: string | null;
      note: string | null;
    };
  }>;
  last_purchased_at: string | null;
};

export type CustomerAddressPayload = {
  address_id?: number | null;
  address?: {
    id?: number | null;
    state_id?: number | null;
    city_id?: number | null;
    district_id?: number | null;
    address_line?: string | null;
    address_line2?: string | null;
    postal_code?: string | null;
    country_code?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    note?: string | null;
  } | null;
  type?: "billing" | "shipping" | "office" | "warehouse" | "other";
  label?: string | null;
  is_default?: boolean | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  note?: string | null;
};

export type CustomerCreatePayload = {
  client_code?: string;
  full_name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  gender?: "male" | "female" | "other" | null;
  tax_code?: string | null;
  status?: "active" | "inactive";
  customer_category_id?: number | null;
  addresses?: CustomerAddressPayload[];
};

export type CustomerUpdatePayload = Partial<CustomerCreatePayload>;

export type LocationItem = {
  id: number;
  code: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CityItem = LocationItem & {
  state_id: number;
};

export type DistrictItem = LocationItem & {
  city_id: number;
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

  getCustomerById: async (id: number | string): Promise<CustomerListItem> => {
    return apiClient.get(`${ENDPOINT}/${id}`);
  },

  updateCustomer: async (id: number | string, data: CustomerUpdatePayload): Promise<CustomerListItem> => {
    return apiClient.put(`${ENDPOINT}/${id}`, data);
  },

  restoreCustomer: async (id: number | string): Promise<CustomerListItem> => {
    return apiClient.post(`${ENDPOINT}/${id}/restore`, {});
  },

  deleteCustomers: async (ids: number[]): Promise<CustomerBulkDeleteResult> => {
    return apiClient.delete(ENDPOINT, { data: { ids } satisfies BulkDeletePayload });
  },

  getStates: async (params?: { is_active?: boolean }): Promise<LocationItem[]> => {
    return apiClient.get("/locations/states", { params });
  },

  getCities: async (params?: { state_id?: number; is_active?: boolean }): Promise<CityItem[]> => {
    return apiClient.get("/locations/cities", { params });
  },

  getDistricts: async (params?: { city_id?: number; is_active?: boolean }): Promise<DistrictItem[]> => {
    return apiClient.get("/locations/districts", { params });
  },
};

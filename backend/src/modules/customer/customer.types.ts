export type CustomerStatusInput = "active" | "inactive" | "soft_deleted" | "deleted";
export type CustomerGenderInput = "male" | "female" | "other";
export type CustomerInvoiceEntityTypeInput = "individual" | "business";

export interface CustomerInvoiceProfileInput {
  entity_type?: CustomerInvoiceEntityTypeInput | null;
  company_name?: string | null;
  buyer_name?: string | null;
  tax_code?: string | null;
  personal_id?: string | null;
  budget_unit_code?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line?: string | null;
  note?: string | null;
}

export interface CustomerListQuery {
  search?: string;
  status?: CustomerStatusInput;
  customer_category_id?: string;
}

export interface CustomerRequestInput {
  client_code?: string;
  full_name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  gender?: CustomerGenderInput | null;
  tax_code?: string | null;
  invoice_profile?: CustomerInvoiceProfileInput | null;
  status?: "active" | "inactive";
  customer_category_id?: number | null;
  addresses?: CustomerAddressRequestInput[];
}

export interface UpdateCustomerRequestInput extends Partial<Omit<CustomerRequestInput, "full_name" | "phone">> {
  full_name?: string;
  phone?: string;
}

export type CustomerAddressTypeInput = "billing" | "shipping" | "office" | "warehouse" | "other";

export interface AddressRequestInput {
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
}

export interface CustomerAddressRequestInput {
  address_id?: number | null;
  address?: AddressRequestInput | null;
  type?: CustomerAddressTypeInput;
  label?: string | null;
  is_default?: boolean | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  note?: string | null;
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

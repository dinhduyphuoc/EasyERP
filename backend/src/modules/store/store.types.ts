export type StoreRoleInput = "owner" | "admin" | "staff";

export type StoreParams = {
  id?: string;
};

export type CreateStoreInput = {
  name?: string;
  currency?: string | null;
  timezone?: string | null;
};

export type UpdateStoreInput = {
  name?: string | null;
  slug?: string | null;
  default_currency?: string | null;
  default_timezone?: string | null;
  profile?: Record<string, unknown> | null;
  default_address?: Record<string, unknown> | null;
  billing_address?: Record<string, unknown> | null;
  return_address?: Record<string, unknown> | null;
};

export type SwitchStoreInput = {
  store_id?: string;
};

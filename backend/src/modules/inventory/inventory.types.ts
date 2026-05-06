export const INVENTORY_BUCKET_FIELDS = [
  "on_hand",
  "available",
  "committed",
  "packing",
  "incoming",
] as const;

export type InventoryBucketField = (typeof INVENTORY_BUCKET_FIELDS)[number];

export type InventoryActorInput = {
  id?: string | null;
  name?: string | null;
};

export type InventoryReferenceInput = {
  reference_type?: string | null;
  reference_id?: string | null;
  reference_code?: string | null;
};

export type InventoryCommandMetaInput = InventoryReferenceInput & {
  actor?: InventoryActorInput | null;
  note?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type InventoryInitializeInput = InventoryCommandMetaInput & {
  product_variant_id: string;
  initial_on_hand: number;
};

export type InventoryQuantityCommandInput = InventoryCommandMetaInput & {
  product_variant_id: string;
  qty: number;
};

export type InventoryAdjustInput = InventoryCommandMetaInput & {
  product_variant_id: string;
  mode: "delta" | "absolute";
  qty?: number;
  target_on_hand?: number;
  reason_code:
    | "actual_count"
    | "damaged"
    | "customer_return"
    | "transfer"
    | "manufacturing"
    | "lost"
    | "other";
};

export type InventoryParams = {
  productVariantId: string;
};

export type InventoryHistoryQuery = {
  limit?: string;
  cursor?: string;
};

export type InventoryStockListQuery = {
  search?: string;
};

export type InventoryAuditStatusInput =
  | "draft"
  | "completed";

export type InventoryAuditLineInput = {
  product_variant_id: string;
  counted_on_hand?: number | null;
  note?: string | null;
};

export type InventoryAuditUpsertInput = {
  audit_code?: string | null;
  status?: "draft";
  note?: string | null;
  counted_at?: string | Date | null;
  account?: InventoryActorInput | null;
  lines: InventoryAuditLineInput[];
};

export type InventoryAuditFinalizeInput = {
  note?: string | null;
  account?: InventoryActorInput | null;
};

export type InventoryAuditListQuery = {
  status?: InventoryAuditStatusInput;
  search?: string;
};

export type InventoryAuditParams = {
  id?: string;
};

export type InventoryAuditSummary = {
  total_lines: number;
  counted_lines: number;
  adjusted_lines: number;
  total_delta_qty: number;
};

export type InventoryImportRowInput = {
  row_no?: number;
  sku_code?: string | null;
  product_variant_id?: string | null;
  mode?: "absolute" | "delta";
  on_hand?: number | null;
  qty?: number | null;
  note?: string | null;
  reason_code?:
    | "actual_count"
    | "damaged"
    | "customer_return"
    | "transfer"
    | "manufacturing"
    | "lost"
    | "other";
};

export type InventoryImportRequestInput = {
  rows: InventoryImportRowInput[];
  actor?: InventoryActorInput | null;
  reference_code?: string | null;
  note?: string | null;
};

export type InventoryImportResultItem = {
  row_no: number;
  sku_code: string;
  mode: "absolute" | "delta";
};

export type InventoryAuditListResponseItem = {
  id: number;
  audit_code: string;
  status: "draft" | "completed";
  note: string | null;
  account: {
    id: string | null;
    name: string | null;
  };
  counted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  summary: InventoryAuditSummary;
};

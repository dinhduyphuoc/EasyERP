import { prisma } from "@lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "@/common";
import type {
  InventoryAdjustInput,
  InventoryAuditFinalizeInput,
  InventoryAuditLineInput,
  InventoryAuditListQuery,
  InventoryAuditUpsertInput,
  InventoryBucketField,
  InventoryCommandMetaInput,
  InventoryHistoryQuery,
  InventoryInitializeInput,
  InventoryStockListQuery,
  InventoryQuantityCommandInput,
} from "./inventory.types";
import type {
  InventoryFieldName,
  InventoryAuditStatus,
  InventoryReasonCode,
  InventoryTransactionType,
  Prisma,
} from "../../../generated/prisma/client";

type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type StockSnapshot = Record<InventoryBucketField, number> & {
  id: number;
  product_variant_id: string;
  version: number;
  created_at: Date;
  updated_at: Date;
};

type StockBuckets = Record<InventoryBucketField, number>;

type HistoryLine = {
  field_name: InventoryFieldName;
  delta_value: number;
  value_after_change: number;
};

type HistoryTransaction = {
  id: number;
  product_variant_id: string;
  transaction_type: InventoryTransactionType;
  reason_code: InventoryReasonCode;
  reference_type: string | null;
  reference_id: string | null;
  reference_code: string | null;
  actor_id: string | null;
  actor_name: string | null;
  note: string | null;
  metadata_json: Prisma.JsonValue;
  created_at: Date;
  lines: HistoryLine[];
};

const HISTORY_DEFAULT_LIMIT = 20;
const HISTORY_MAX_LIMIT = 100;
const AUDIT_CODE_PREFIX = "AUD";

const ACTION_LABELS: Record<InventoryTransactionType, string> = {
  initialize: "Khởi tạo",
  adjust: "Điều chỉnh",
  reserve: "Giữ hàng",
  release: "Nhả giữ",
  move_to_packing: "Chuyển đóng gói",
  pack_cancel: "Hủy đóng gói",
  fulfill: "Xuất kho",
  return_restock: "Nhập trả",
  incoming_create: "Tạo hàng về",
  incoming_receive: "Nhận hàng về",
};

const REASON_LABELS: Partial<Record<InventoryReasonCode, string>> = {
  initialize: "Khởi tạo",
  actual_count: "Kiểm kê thực tế",
  damaged: "Hàng hư hỏng",
  customer_return: "Khách trả hàng",
  transfer: "Chuyển kho",
  manufacturing: "Sản xuất",
  lost: "Thất lạc",
  order_reserved: "Đơn hàng giữ tồn",
  order_released: "Nhả giữ đơn hàng",
  packing_started: "Bắt đầu đóng gói",
  packing_cancelled: "Hủy đóng gói",
  order_fulfilled: "Xuất đơn",
  purchase_incoming: "Tạo hàng đang về",
  purchase_received: "Nhận hàng nhập",
  other: "Khác",
};

const ZERO_BUCKETS: StockBuckets = {
  on_hand: 0,
  available: 0,
  committed: 0,
  packing: 0,
  incoming: 0,
};

const BUCKET_FIELDS: InventoryBucketField[] = [
  "on_hand",
  "available",
  "committed",
  "packing",
  "incoming",
];

const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toNullableTrimmedString = (value: unknown) => {
  if (value === null) {
    return null;
  }

  return toOptionalTrimmedString(value) ?? null;
};

const ensurePlainObject = (value: unknown): Prisma.InputJsonObject => {
  if (!value) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("metadata must be an object");
  }

  return value as Prisma.InputJsonObject;
};

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return value;
};

const parseInteger = (value: unknown, fieldName: string) => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BadRequestError(`${fieldName} must be an integer`);
  }

  return value;
};

const parseNonNegativeInteger = (value: unknown, fieldName: string) => {
  const parsed = parseInteger(value, fieldName);

  if (parsed < 0) {
    throw new BadRequestError(`${fieldName} must be greater than or equal to 0`);
  }

  return parsed;
};

const ensureVariantExists = async (tx: PrismaTransaction, productVariantId: string) => {
  const variant = await tx.productVariant.findUnique({
    where: { sku: productVariantId },
    select: { sku: true },
  });

  if (!variant) {
    throw new NotFoundError("Product variant not found");
  }
};

const getIdempotentTransaction = async (
  tx: PrismaTransaction,
  idempotencyKey: string | null | undefined,
) => {
  if (!idempotencyKey) {
    return null;
  }

  return tx.inventoryTransaction.findUnique({
    where: { idempotency_key: idempotencyKey },
    include: { lines: true },
  });
};

const createStockSnapshot = (source: Pick<StockSnapshot, keyof StockBuckets>): StockBuckets => ({
  on_hand: source.on_hand,
  available: source.available,
  committed: source.committed,
  packing: source.packing,
  incoming: source.incoming,
});

const validateBuckets = (buckets: StockBuckets) => {
  for (const field of ["committed", "packing", "incoming"] as const) {
    if (buckets[field] < 0) {
      throw new ConflictError(`${field} cannot be negative`);
    }
  }

  if (buckets.on_hand !== buckets.available + buckets.committed + buckets.packing) {
    throw new ConflictError("Inventory buckets are inconsistent");
  }
};

const lockStock = async (
  tx: PrismaTransaction,
  productVariantId: string,
) => {
  const rows = await tx.$queryRaw<StockSnapshot[]>`
    SELECT id, product_variant_id, on_hand, available, committed, packing, incoming, version, created_at, updated_at
    FROM "InventoryStock"
    WHERE product_variant_id = ${productVariantId}
    FOR UPDATE
  `;

  return rows[0] ?? null;
};

const buildHistoryChanges = (lines: HistoryLine[]) => {
  const map = new Map<InventoryBucketField, { delta: number; after: number }>();

  for (const line of lines) {
    map.set(line.field_name as InventoryBucketField, {
      delta: line.delta_value,
      after: line.value_after_change,
    });
  }

  return {
    on_hand: map.get("on_hand") ?? { delta: 0, after: 0 },
    available: map.get("available") ?? { delta: 0, after: 0 },
    committed: map.get("committed") ?? { delta: 0, after: 0 },
    packing: map.get("packing") ?? { delta: 0, after: 0 },
    incoming: map.get("incoming") ?? { delta: 0, after: 0 },
  };
};

const buildStockResponse = (stock: StockBuckets & { version?: number; updated_at?: Date | null }) => ({
  on_hand: stock.on_hand,
  available: stock.available,
  committed: stock.committed,
  packing: stock.packing,
  incoming: stock.incoming,
  version: stock.version ?? 0,
  updated_at: stock.updated_at?.toISOString() ?? null,
});

const toHistoryItem = (transaction: HistoryTransaction) => ({
  id: String(transaction.id),
  created_at: transaction.created_at.toISOString(),
  transaction_type: transaction.transaction_type,
  action: ACTION_LABELS[transaction.transaction_type],
  reason_code: transaction.reason_code,
  reason: REASON_LABELS[transaction.reason_code] ?? null,
  actor: {
    id: transaction.actor_id,
    name: transaction.actor_name,
  },
  reference_type: transaction.reference_type,
  reference_id: transaction.reference_id,
  reference_code: transaction.reference_code,
  note: transaction.note,
  metadata: transaction.metadata_json,
  changes: buildHistoryChanges(transaction.lines),
});

const createLinesPayload = (deltas: StockBuckets, next: StockBuckets) =>
  BUCKET_FIELDS.map((field) => ({
    field_name: field,
    delta_value: deltas[field],
    value_after_change: next[field],
  }));

const buildCommandMeta = (input: InventoryCommandMetaInput) => ({
  reference_type: toNullableTrimmedString(input.reference_type),
  reference_id: toNullableTrimmedString(input.reference_id),
  reference_code: toNullableTrimmedString(input.reference_code),
  actor_id: toNullableTrimmedString(input.actor?.id),
  actor_name: toNullableTrimmedString(input.actor?.name),
  note: toNullableTrimmedString(input.note),
  idempotency_key: toNullableTrimmedString(input.idempotency_key),
  metadata_json: ensurePlainObject(input.metadata),
});

const buildMutationResponse = async (
  tx: PrismaTransaction,
  transactionId: number,
  productVariantId: string,
) => {
  const transaction = await tx.inventoryTransaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { lines: true },
  });

  const stock = await tx.inventoryStock.findUniqueOrThrow({
    where: { product_variant_id: productVariantId },
  });

  return {
    transaction: toHistoryItem(transaction),
    stock: buildStockResponse(stock),
  };
};

const parseOptionalDate = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }

  return date;
};

const parseNonNegativeIntegerOrNull = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return parseNonNegativeInteger(value, fieldName);
};

const parseIntegerOrNull = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return parseInteger(value, fieldName);
};

const parseAuditDraftStatus = (value: unknown): InventoryAuditStatus => {
  if (value === undefined || value === null || value === "") {
    return "draft";
  }

  if (value === "draft") {
    return "draft";
  }

  throw new BadRequestError("status must be draft");
};

const buildAuditCode = async (tx: PrismaTransaction) => {
  const latestAudit = await tx.inventoryAudit.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });

  const nextNumber = (latestAudit?.id ?? 0) + 1;
  return `${AUDIT_CODE_PREFIX}-${String(nextNumber).padStart(6, "0")}`;
};

const ensureAuditCodeIsUnique = async (
  tx: PrismaTransaction,
  auditCode: string,
  ignoreAuditId?: number,
) => {
  const existingAudit = await tx.inventoryAudit.findFirst({
    where: {
      audit_code: auditCode,
      ...(ignoreAuditId ? { id: { not: ignoreAuditId } } : {}),
    },
    select: { id: true },
  });

  if (existingAudit) {
    throw new ConflictError(`Inventory audit code "${auditCode}" already exists`);
  }
};

const buildAuditLineResponse = (line: {
  id: number;
  product_variant_id: string;
  system_on_hand: number;
  counted_on_hand: number | null;
  delta_qty: number | null;
  note: string | null;
  created_at: Date;
  updated_at: Date;
  product_variant?: {
    sku: string;
    selling_price: Prisma.Decimal;
    cogs: Prisma.Decimal;
    image_url: string | null;
    product: {
      id: number;
      product_name: string;
      unit: string | null;
      image_url: string | null;
      status: "active" | "inactive" | "draft" | "deleted";
    };
    attribute_values: Array<{
      attribute_value: {
        value: string;
      };
    }>;
  };
}) => {
  const productVariant = line.product_variant;
  const optionLabel = productVariant?.attribute_values
    .map((item) => item.attribute_value.value)
    .filter(Boolean)
    .join(" / ");

  return {
    id: line.id,
    product_variant_id: line.product_variant_id,
    sku: productVariant?.sku ?? line.product_variant_id,
    product_id: productVariant?.product.id ?? null,
    product_name: productVariant?.product.product_name ?? null,
    product_status: productVariant?.product.status ?? "deleted",
    display_name:
      productVariant == null
        ? line.product_variant_id
        : optionLabel
          ? `${productVariant.product.product_name} - ${optionLabel}`
          : productVariant.product.product_name,
    unit: productVariant?.product.unit ?? null,
    image_url: productVariant?.image_url ?? productVariant?.product.image_url ?? null,
    selling_price: productVariant?.selling_price?.toString() ?? null,
    cogs: productVariant?.cogs?.toString() ?? null,
    system_on_hand: line.system_on_hand,
    counted_on_hand: line.counted_on_hand,
    delta_qty: line.delta_qty,
    note: line.note,
    created_at: line.created_at.toISOString(),
    updated_at: line.updated_at.toISOString(),
  };
};

const buildAuditResponse = (audit: {
  id: number;
  audit_code: string;
  status: InventoryAuditStatus;
  note: string | null;
  account_id: string | null;
  account_name: string | null;
  counted_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  lines: Array<Parameters<typeof buildAuditLineResponse>[0]>;
}) => {
  const totalLines = audit.lines.length;
  const countedLines = audit.lines.filter((line) => line.counted_on_hand !== null).length;
  const adjustedLines = audit.lines.filter((line) => (line.delta_qty ?? 0) !== 0).length;
  const totalDeltaQty = audit.lines.reduce((sum, line) => sum + (line.delta_qty ?? 0), 0);

  return {
    id: audit.id,
    audit_code: audit.audit_code,
    status: audit.status,
    note: audit.note,
    account: {
      id: audit.account_id,
      name: audit.account_name,
    },
    counted_at: audit.counted_at?.toISOString() ?? null,
    completed_at: audit.completed_at?.toISOString() ?? null,
    created_at: audit.created_at.toISOString(),
    updated_at: audit.updated_at.toISOString(),
    summary: {
      total_lines: totalLines,
      counted_lines: countedLines,
      adjusted_lines: adjustedLines,
      total_delta_qty: totalDeltaQty,
    },
    lines: audit.lines.map((line) => buildAuditLineResponse(line)),
  };
};

const applyInventoryMutation = async (params: {
  tx: PrismaTransaction;
  productVariantId: string;
  transactionType: InventoryTransactionType;
  reasonCode: InventoryReasonCode;
  meta: InventoryCommandMetaInput;
  computeNext: (current: StockSnapshot) => { deltas: StockBuckets; next: StockBuckets };
}) => {
  const existing = await getIdempotentTransaction(
    params.tx,
    params.meta.idempotency_key,
  );

  if (existing) {
    return {
      transaction: toHistoryItem(existing),
      stock: buildStockResponse(
        await params.tx.inventoryStock.findUniqueOrThrow({
          where: { product_variant_id: params.productVariantId },
        }),
      ),
    };
  }

  await ensureVariantExists(params.tx, params.productVariantId);

  const current = await lockStock(params.tx, params.productVariantId);

  if (!current) {
    throw new NotFoundError("Inventory stock not initialized");
  }

  const { deltas, next } = params.computeNext(current);

  validateBuckets(next);

  const transaction = await params.tx.inventoryTransaction.create({
    data: {
      product_variant_id: params.productVariantId,
      transaction_type: params.transactionType,
      reason_code: params.reasonCode,
      ...buildCommandMeta(params.meta),
      lines: {
        create: createLinesPayload(deltas, next),
      },
    },
  });

  await params.tx.inventoryStock.update({
    where: { product_variant_id: params.productVariantId },
    data: {
      on_hand: next.on_hand,
      available: next.available,
      committed: next.committed,
      packing: next.packing,
      incoming: next.incoming,
      version: { increment: 1 },
    },
  });

  return buildMutationResponse(params.tx, transaction.id, params.productVariantId);
};

const ensureCanDecreaseAvailable = (stock: StockSnapshot, qty: number) => {
  if (stock.available < qty) {
    throw new ConflictError("Insufficient available stock");
  }
};

const validateAdjustReason = (
  input: InventoryAdjustInput,
  delta: number,
  note: string | undefined,
) => {
  const isIncrease = delta > 0;
  const isDecrease = delta < 0;

  switch (input.reason_code) {
    case "actual_count":
      return;
    case "damaged":
    case "lost":
      if (!isDecrease || input.mode !== "delta") {
        throw new BadRequestError(`${input.reason_code} only supports negative delta adjustments`);
      }
      return;
    case "customer_return":
    case "manufacturing":
      if (!isIncrease || input.mode !== "delta") {
        throw new BadRequestError(`${input.reason_code} only supports positive delta adjustments`);
      }
      return;
    case "transfer":
      if (input.mode !== "delta") {
        throw new BadRequestError("transfer only supports delta adjustments");
      }
      return;
    case "other":
      if (input.mode === "absolute" && !note) {
        throw new BadRequestError("note is required for absolute adjustment with reason_code other");
      }
      return;
    default:
      throw new BadRequestError("Unsupported reason_code");
  }
};

const computeAdjustChange = (current: StockSnapshot, input: InventoryAdjustInput) => {
  const note = toOptionalTrimmedString(input.note);

  if (input.mode === "delta") {
    const qty = parseInteger(input.qty, "qty");

    if (qty === 0) {
      throw new BadRequestError("qty must not be 0");
    }

    validateAdjustReason(input, qty, note);

    if (qty < 0) {
      ensureCanDecreaseAvailable(current, Math.abs(qty));
    }

    const deltas: StockBuckets = {
      ...ZERO_BUCKETS,
      on_hand: qty,
      available: qty,
    };

    const next: StockBuckets = {
      on_hand: current.on_hand + qty,
      available: current.available + qty,
      committed: current.committed,
      packing: current.packing,
      incoming: current.incoming,
    };

    return { deltas, next };
  }

  const targetOnHand = parseInteger(input.target_on_hand, "target_on_hand");
  const delta = targetOnHand - current.on_hand;

  validateAdjustReason(input, delta, note);

  const targetAvailable = targetOnHand - current.committed - current.packing;

  const deltas: StockBuckets = {
    ...ZERO_BUCKETS,
    on_hand: delta,
    available: targetAvailable - current.available,
  };

  const next: StockBuckets = {
    on_hand: targetOnHand,
    available: targetAvailable,
    committed: current.committed,
    packing: current.packing,
    incoming: current.incoming,
  };

  return { deltas, next };
};

const normalizeAuditLineInput = (line: InventoryAuditLineInput, index: number) => {
  const productVariantId = toOptionalTrimmedString(line.product_variant_id);

  if (!productVariantId) {
    throw new BadRequestError(`lines[${index}].product_variant_id is required`);
  }

  return {
    product_variant_id: productVariantId,
    counted_on_hand: parseIntegerOrNull(
      line.counted_on_hand,
      `lines[${index}].counted_on_hand`,
    ),
    note: toNullableTrimmedString(line.note),
  };
};

const normalizeAuditPayload = (input: InventoryAuditUpsertInput) => {
  if (!Array.isArray(input.lines)) {
    throw new BadRequestError("lines must be an array");
  }

  const status = parseAuditDraftStatus(input.status);
  const lines = input.lines.map((line, index) => normalizeAuditLineInput(line, index));
  const uniqueVariantIds = new Set(lines.map((line) => line.product_variant_id));

  if (uniqueVariantIds.size !== lines.length) {
    throw new BadRequestError("Duplicate product_variant_id is not allowed in audit lines");
  }

  if (status === "draft" && lines.length === 0) {
    throw new BadRequestError("draft audit must contain at least one line");
  }

  return {
    audit_code: toOptionalTrimmedString(input.audit_code),
    status,
    note: toNullableTrimmedString(input.note),
    counted_at: parseOptionalDate(input.counted_at, "counted_at"),
    account_id: toNullableTrimmedString(input.account?.id),
    account_name: toNullableTrimmedString(input.account?.name),
    lines,
  };
};

const ensureVariantStocks = async (
  tx: PrismaTransaction,
  productVariantIds: string[],
) => {
  if (productVariantIds.length === 0) {
    return new Map<string, number>();
  }

  const variants = await tx.productVariant.findMany({
    where: { sku: { in: productVariantIds } },
    select: {
      sku: true,
      inventory_stock: {
        select: {
          on_hand: true,
        },
      },
    },
  });

  if (variants.length !== productVariantIds.length) {
    const existingIds = new Set(variants.map((variant) => variant.sku));
    const missingId = productVariantIds.find((id) => !existingIds.has(id));
    throw new NotFoundError(`Product variant "${missingId}" not found`);
  }

  return new Map(
    variants.map((variant) => [variant.sku, variant.inventory_stock?.on_hand ?? 0]),
  );
};

const buildAuditLineCreateManyData = async (
  tx: PrismaTransaction,
  lines: ReturnType<typeof normalizeAuditPayload>["lines"],
  existingSystemQtyByVariantId?: Map<string, number>,
) => {
  const systemQtyByVariantId =
    existingSystemQtyByVariantId ?? (await ensureVariantStocks(tx, lines.map((line) => line.product_variant_id)));

  return lines.map((line) => {
    const systemOnHand = systemQtyByVariantId.get(line.product_variant_id);

    if (systemOnHand === undefined) {
      throw new NotFoundError(`Product variant "${line.product_variant_id}" not found`);
    }

    return {
      product_variant_id: line.product_variant_id,
      system_on_hand: systemOnHand,
      counted_on_hand: line.counted_on_hand,
      delta_qty:
        line.counted_on_hand === null ? null : line.counted_on_hand - systemOnHand,
      note: line.note,
    };
  });
};

const auditInclude = {
  lines: {
    orderBy: { id: "asc" },
    include: {
      product_variant: {
        include: {
          product: {
            select: {
              id: true,
              product_name: true,
              unit: true,
              image_url: true,
              status: true,
            },
          },
          attribute_values: {
            include: {
              attribute_value: {
                select: {
                  value: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.InventoryAuditInclude;

const parseHistoryLimit = (query: InventoryHistoryQuery) => {
  if (!query.limit) {
    return HISTORY_DEFAULT_LIMIT;
  }

  const limit = Number(query.limit);

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new BadRequestError("limit must be a positive integer");
  }

  return Math.min(limit, HISTORY_MAX_LIMIT);
};

const parseCursor = (query: InventoryHistoryQuery) => {
  if (!query.cursor) {
    return undefined;
  }

  const cursor = Number(query.cursor);

  if (!Number.isInteger(cursor) || cursor <= 0) {
    throw new BadRequestError("cursor must be a positive integer");
  }

  return cursor;
};

export const InventoryService = {
  getStockList: async (query: InventoryStockListQuery) => {
    const search = toOptionalTrimmedString(query.search)?.toLowerCase();

    const variants = await prisma.productVariant.findMany({
      where: {
        status: {
          not: "deleted",
        },
        product: {
          status: {
            not: "deleted",
          },
        },
      },
      include: {
          product: {
            select: {
              id: true,
              product_name: true,
              unit: true,
              image_url: true,
              status: true,
              attributes: {
                select: {
                  id: true,
              },
            },
          },
        },
        attribute_values: {
          include: {
            attribute_value: true,
          },
        },
        inventory_stock: true,
      },
      orderBy: [{ product: { product_name: "asc" } }, { sku: "asc" }],
    });

    return variants
      .map((variant) => {
        const isSimpleProduct = variant.product.attributes.length === 0;
        const optionLabel = variant.attribute_values
          .map((item) => item.attribute_value.value)
          .filter(Boolean)
          .join(" / ");
        const displayName = isSimpleProduct
          ? variant.product.product_name
          : `${variant.product.product_name} - ${optionLabel || variant.sku}`;

        return {
          product_variant_id: variant.sku,
          product_id: variant.product.id,
          product_name: variant.product.product_name,
          display_name: displayName,
          sku: variant.sku,
          unit: variant.product.unit,
          image_url: variant.image_url ?? variant.product.image_url,
          product_status: variant.product.status,
          on_hand: variant.inventory_stock?.on_hand ?? 0,
          available: variant.inventory_stock?.available ?? 0,
          committed: variant.inventory_stock?.committed ?? 0,
          packing: variant.inventory_stock?.packing ?? 0,
          incoming: variant.inventory_stock?.incoming ?? 0,
          selling_price: variant.selling_price.toString(),
          cogs: variant.cogs.toString(),
          is_variant: !isSimpleProduct,
        };
      })
      .filter((item) => {
        if (!search) {
          return true;
        }

        return (
          item.display_name.toLowerCase().includes(search) ||
          item.product_name.toLowerCase().includes(search) ||
          item.sku.toLowerCase().includes(search)
        );
      });
  },

  getAuditList: async (query: InventoryAuditListQuery) => {
    const search = toOptionalTrimmedString(query.search);
    const status =
      query.status === undefined
        ? undefined
        : (["draft", "completed"].includes(query.status)
            ? query.status
            : undefined);

    if (query.status !== undefined && !status) {
      throw new BadRequestError("Invalid audit status");
    }

    const audits = await prisma.inventoryAudit.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { audit_code: { contains: search, mode: "insensitive" } },
                { note: { contains: search, mode: "insensitive" } },
                { account_name: { contains: search, mode: "insensitive" } },
                {
                  lines: {
                    some: {
                      product_variant_id: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: auditInclude,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
    });

    return audits.map((audit) => buildAuditResponse(audit));
  },

  getAuditById: async (id: number) => {
    const audit = await prisma.inventoryAudit.findUnique({
      where: { id },
      include: auditInclude,
    });

    if (!audit) {
      throw new NotFoundError("Inventory audit not found");
    }

    return buildAuditResponse(audit);
  },

  createAudit: async (input: InventoryAuditUpsertInput) => {
    const payload = normalizeAuditPayload(input);

    return prisma.$transaction(async (tx) => {
      const auditCode = payload.audit_code ?? (await buildAuditCode(tx));
      await ensureAuditCodeIsUnique(tx, auditCode);
      const lineData = await buildAuditLineCreateManyData(tx, payload.lines);

      const audit = await tx.inventoryAudit.create({
        data: {
          audit_code: auditCode,
          status: payload.status,
          note: payload.note,
          account_id: payload.account_id,
          account_name: payload.account_name,
          counted_at: payload.counted_at,
          lines: lineData.length > 0 ? { createMany: { data: lineData } } : undefined,
        },
        include: auditInclude,
      });

      return buildAuditResponse(audit);
    });
  },

  updateAudit: async (id: number, input: InventoryAuditUpsertInput) => {
    const payload = normalizeAuditPayload(input);

    return prisma.$transaction(async (tx) => {
      const existingAudit = await tx.inventoryAudit.findUnique({
        where: { id },
        include: {
          lines: {
            orderBy: { id: "asc" },
          },
        },
      });

      if (!existingAudit) {
        throw new NotFoundError("Inventory audit not found");
      }

      if (existingAudit.status === "completed") {
        throw new ConflictError("Completed audit cannot be edited");
      }

      const existingSystemQtyByVariantId = new Map(
        existingAudit.lines.map((line) => [line.product_variant_id, line.system_on_hand]),
      );
      const newVariantIds = payload.lines
        .map((line) => line.product_variant_id)
        .filter((variantId) => !existingSystemQtyByVariantId.has(variantId));
      const currentSystemQtyByVariantId = await ensureVariantStocks(tx, newVariantIds);

      await tx.inventoryAuditLine.deleteMany({
        where: { audit_id: id },
      });

      const mergedSystemQtyByVariantId = new Map(existingSystemQtyByVariantId);
      for (const [variantId, qty] of currentSystemQtyByVariantId.entries()) {
        mergedSystemQtyByVariantId.set(variantId, qty);
      }

      const lineData = await buildAuditLineCreateManyData(
        tx,
        payload.lines,
        mergedSystemQtyByVariantId,
      );
      const nextAuditCode = payload.audit_code ?? existingAudit.audit_code;
      await ensureAuditCodeIsUnique(tx, nextAuditCode, id);

      const audit = await tx.inventoryAudit.update({
        where: { id },
        data: {
          audit_code: nextAuditCode,
          status: payload.status,
          note: payload.note,
          account_id: payload.account_id,
          account_name: payload.account_name,
          counted_at: payload.counted_at,
          lines: lineData.length > 0 ? { createMany: { data: lineData } } : undefined,
        },
        include: auditInclude,
      });

      return buildAuditResponse(audit);
    });
  },

  deleteAudit: async (id: number) => {
    return prisma.$transaction(async (tx) => {
      const audit = await tx.inventoryAudit.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
        },
      });

      if (!audit) {
        throw new NotFoundError("Inventory audit not found");
      }

      if (audit.status !== "draft") {
        throw new ConflictError("Only draft audit can be deleted");
      }

      await tx.inventoryAudit.delete({
        where: { id },
      });
    });
  },

  completeAudit: async (id: number, input: InventoryAuditFinalizeInput) => {
    return prisma.$transaction(async (tx) => {
      const audit = await tx.inventoryAudit.findUnique({
        where: { id },
        include: {
          lines: {
            orderBy: { id: "asc" },
          },
        },
      });

      if (!audit) {
        throw new NotFoundError("Inventory audit not found");
      }

      if (audit.status === "completed") {
        throw new ConflictError("Inventory audit already completed");
      }

      if (audit.lines.length === 0) {
        throw new BadRequestError("Inventory audit must contain at least one line");
      }

      const incompleteLine = audit.lines.find((line) => line.counted_on_hand === null);

      if (incompleteLine) {
        throw new BadRequestError("All audit lines must have counted_on_hand before completion");
      }

      const actorId =
        toNullableTrimmedString(input.account?.id) ??
        audit.account_id;
      const actorName =
        toNullableTrimmedString(input.account?.name) ??
        audit.account_name;
      const auditNote = toNullableTrimmedString(input.note) ?? audit.note;

      for (const line of audit.lines) {
        const countedOnHand = line.counted_on_hand;

        if (countedOnHand === null || countedOnHand === line.system_on_hand) {
          continue;
        }

        await applyInventoryMutation({
          tx,
          productVariantId: line.product_variant_id,
          transactionType: "adjust",
          reasonCode: "actual_count",
          meta: {
            reference_type: "inventory_audit",
            reference_id: String(audit.id),
            reference_code: audit.audit_code,
            actor: {
              id: actorId,
              name: actorName,
            },
            note: line.note ?? auditNote ?? `Inventory audit ${audit.audit_code}`,
            metadata: {
              inventory_audit_id: audit.id,
              inventory_audit_line_id: line.id,
              mode: "absolute",
              target_on_hand: countedOnHand,
            },
          },
          computeNext: (current) =>
            computeAdjustChange(current, {
              product_variant_id: line.product_variant_id,
              mode: "absolute",
              target_on_hand: countedOnHand,
              reason_code: "actual_count",
              note: line.note ?? auditNote ?? undefined,
            }),
        });
      }

      const updatedAudit = await tx.inventoryAudit.update({
        where: { id },
        data: {
          status: "completed",
          completed_at: new Date(),
          counted_at: audit.counted_at ?? new Date(),
          note: auditNote,
          account_id: actorId,
          account_name: actorName,
        },
        include: auditInclude,
      });

      return buildAuditResponse(updatedAudit);
    });
  },

  getInventory: async (productVariantId: string) => {
    const variantId = toOptionalTrimmedString(productVariantId);

    if (!variantId) {
      throw new BadRequestError("Invalid product variant id");
    }

    await ensureVariantExists(prisma, variantId);

    const stock = await prisma.inventoryStock.findUnique({
      where: { product_variant_id: variantId },
    });

    if (!stock) {
      return {
        product_variant_id: variantId,
        stock: buildStockResponse({
          ...ZERO_BUCKETS,
          version: 0,
          updated_at: null,
        }),
      };
    }

    return {
      product_variant_id: variantId,
      stock: buildStockResponse(stock),
    };
  },

  getHistory: async (productVariantId: string, query: InventoryHistoryQuery) => {
    const variantId = toOptionalTrimmedString(productVariantId);

    if (!variantId) {
      throw new BadRequestError("Invalid product variant id");
    }

    await ensureVariantExists(prisma, variantId);

    const limit = parseHistoryLimit(query);
    const cursor = parseCursor(query);

    const items = await prisma.inventoryTransaction.findMany({
      where: {
        product_variant_id: variantId,
      },
      include: {
        lines: {
          orderBy: { id: "asc" },
        },
      },
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;

    return {
      items: pageItems.map((item) => toHistoryItem(item)),
      next_cursor: hasMore ? String(pageItems[pageItems.length - 1]!.id) : null,
    };
  },

  initialize: async (input: InventoryInitializeInput) => {
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    const initialOnHand = parseNonNegativeInteger(input.initial_on_hand, "initial_on_hand");

    return prisma.$transaction(async (tx) => {
      const existing = await getIdempotentTransaction(tx, input.idempotency_key);

      if (existing) {
        return {
          transaction: toHistoryItem(existing),
          stock: buildStockResponse(
            await tx.inventoryStock.findUniqueOrThrow({
              where: { product_variant_id: productVariantId },
            }),
          ),
        };
      }

      await ensureVariantExists(tx, productVariantId);

      const existingStock = await tx.inventoryStock.findUnique({
        where: { product_variant_id: productVariantId },
        select: { id: true },
      });

      if (existingStock) {
        throw new ConflictError("Inventory stock already initialized");
      }

      const next: StockBuckets = {
        on_hand: initialOnHand,
        available: initialOnHand,
        committed: 0,
        packing: 0,
        incoming: 0,
      };

      validateBuckets(next);

      await tx.inventoryStock.create({
        data: {
          product_variant_id: productVariantId,
          ...next,
          version: 1,
        },
      });

      const transaction = await tx.inventoryTransaction.create({
        data: {
          product_variant_id: productVariantId,
          transaction_type: "initialize",
          reason_code: "initialize",
          ...buildCommandMeta(input),
          lines: {
            create: createLinesPayload(
              {
                on_hand: initialOnHand,
                available: initialOnHand,
                committed: 0,
                packing: 0,
                incoming: 0,
              },
              next,
            ),
          },
        },
      });

      return buildMutationResponse(tx, transaction.id, productVariantId);
    });
  },

  adjust: async (input: InventoryAdjustInput) => {
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    return prisma.$transaction((tx) =>
      applyInventoryMutation({
        tx,
        productVariantId,
        transactionType: "adjust",
        reasonCode: input.reason_code,
        meta: {
          ...input,
          metadata: {
            ...ensurePlainObject(input.metadata),
            mode: input.mode,
            ...(input.mode === "absolute" ? { target_on_hand: input.target_on_hand ?? null } : {}),
          },
        },
        computeNext: (current) => computeAdjustChange(current, input),
      }),
    );
  },

  reserve: async (input: InventoryQuantityCommandInput) => {
    const qty = parsePositiveInteger(input.qty, "qty");
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    return prisma.$transaction((tx) =>
      applyInventoryMutation({
        tx,
        productVariantId,
        transactionType: "reserve",
        reasonCode: "order_reserved",
        meta: input,
        computeNext: (current) => {
          ensureCanDecreaseAvailable(current, qty);

          return {
            deltas: {
              on_hand: 0,
              available: -qty,
              committed: qty,
              packing: 0,
              incoming: 0,
            },
            next: {
              on_hand: current.on_hand,
              available: current.available - qty,
              committed: current.committed + qty,
              packing: current.packing,
              incoming: current.incoming,
            },
          };
        },
      }),
    );
  },

  release: async (input: InventoryQuantityCommandInput) => {
    const qty = parsePositiveInteger(input.qty, "qty");
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    return prisma.$transaction((tx) =>
      applyInventoryMutation({
        tx,
        productVariantId,
        transactionType: "release",
        reasonCode: "order_released",
        meta: input,
        computeNext: (current) => {
          if (current.committed < qty) {
            throw new ConflictError("Insufficient committed stock");
          }

          return {
            deltas: {
              on_hand: 0,
              available: qty,
              committed: -qty,
              packing: 0,
              incoming: 0,
            },
            next: {
              on_hand: current.on_hand,
              available: current.available + qty,
              committed: current.committed - qty,
              packing: current.packing,
              incoming: current.incoming,
            },
          };
        },
      }),
    );
  },

  moveToPacking: async (input: InventoryQuantityCommandInput) => {
    const qty = parsePositiveInteger(input.qty, "qty");
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    return prisma.$transaction((tx) =>
      applyInventoryMutation({
        tx,
        productVariantId,
        transactionType: "move_to_packing",
        reasonCode: "packing_started",
        meta: input,
        computeNext: (current) => {
          if (current.committed < qty) {
            throw new ConflictError("Insufficient committed stock");
          }

          return {
            deltas: {
              on_hand: 0,
              available: 0,
              committed: -qty,
              packing: qty,
              incoming: 0,
            },
            next: {
              on_hand: current.on_hand,
              available: current.available,
              committed: current.committed - qty,
              packing: current.packing + qty,
              incoming: current.incoming,
            },
          };
        },
      }),
    );
  },

  packCancel: async (input: InventoryQuantityCommandInput) => {
    const qty = parsePositiveInteger(input.qty, "qty");
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    return prisma.$transaction((tx) =>
      applyInventoryMutation({
        tx,
        productVariantId,
        transactionType: "pack_cancel",
        reasonCode: "packing_cancelled",
        meta: input,
        computeNext: (current) => {
          if (current.packing < qty) {
            throw new ConflictError("Insufficient packing stock");
          }

          return {
            deltas: {
              on_hand: 0,
              available: 0,
              committed: qty,
              packing: -qty,
              incoming: 0,
            },
            next: {
              on_hand: current.on_hand,
              available: current.available,
              committed: current.committed + qty,
              packing: current.packing - qty,
              incoming: current.incoming,
            },
          };
        },
      }),
    );
  },

  fulfill: async (input: InventoryQuantityCommandInput) => {
    const qty = parsePositiveInteger(input.qty, "qty");
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    return prisma.$transaction((tx) =>
      applyInventoryMutation({
        tx,
        productVariantId,
        transactionType: "fulfill",
        reasonCode: "order_fulfilled",
        meta: input,
        computeNext: (current) => {
          if (current.packing < qty) {
            throw new ConflictError("Insufficient packing stock");
          }

          return {
            deltas: {
              on_hand: -qty,
              available: 0,
              committed: 0,
              packing: -qty,
              incoming: 0,
            },
            next: {
              on_hand: current.on_hand - qty,
              available: current.available,
              committed: current.committed,
              packing: current.packing - qty,
              incoming: current.incoming,
            },
          };
        },
      }),
    );
  },

  returnRestock: async (input: InventoryQuantityCommandInput) => {
    const qty = parsePositiveInteger(input.qty, "qty");
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    return prisma.$transaction((tx) =>
      applyInventoryMutation({
        tx,
        productVariantId,
        transactionType: "return_restock",
        reasonCode: "customer_return",
        meta: input,
        computeNext: (current) => ({
          deltas: {
            on_hand: qty,
            available: qty,
            committed: 0,
            packing: 0,
            incoming: 0,
          },
          next: {
            on_hand: current.on_hand + qty,
            available: current.available + qty,
            committed: current.committed,
            packing: current.packing,
            incoming: current.incoming,
          },
        }),
      }),
    );
  },

  incomingCreate: async (input: InventoryQuantityCommandInput) => {
    const qty = parsePositiveInteger(input.qty, "qty");
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    return prisma.$transaction((tx) =>
      applyInventoryMutation({
        tx,
        productVariantId,
        transactionType: "incoming_create",
        reasonCode: "purchase_incoming",
        meta: input,
        computeNext: (current) => ({
          deltas: {
            on_hand: 0,
            available: 0,
            committed: 0,
            packing: 0,
            incoming: qty,
          },
          next: {
            on_hand: current.on_hand,
            available: current.available,
            committed: current.committed,
            packing: current.packing,
            incoming: current.incoming + qty,
          },
        }),
      }),
    );
  },

  incomingReceive: async (input: InventoryQuantityCommandInput) => {
    const qty = parsePositiveInteger(input.qty, "qty");
    const productVariantId = toOptionalTrimmedString(input.product_variant_id);

    if (!productVariantId) {
      throw new BadRequestError("product_variant_id is required");
    }

    return prisma.$transaction((tx) =>
      applyInventoryMutation({
        tx,
        productVariantId,
        transactionType: "incoming_receive",
        reasonCode: "purchase_received",
        meta: input,
        computeNext: (current) => {
          if (current.incoming < qty) {
            throw new ConflictError("Insufficient incoming stock");
          }

          return {
            deltas: {
              on_hand: qty,
              available: qty,
              committed: 0,
              packing: 0,
              incoming: -qty,
            },
            next: {
              on_hand: current.on_hand + qty,
              available: current.available + qty,
              committed: current.committed,
              packing: current.packing,
              incoming: current.incoming - qty,
            },
          };
        },
      }),
    );
  },
};

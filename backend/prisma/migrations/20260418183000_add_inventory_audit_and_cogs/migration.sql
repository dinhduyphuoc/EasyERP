CREATE TYPE "InventoryAuditStatus" AS ENUM (
    'draft',
    'pending',
    'completed',
    'cancelled'
);

ALTER TABLE "Product"
    ADD COLUMN "cogs" DECIMAL(12,2),
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ProductVariant"
    RENAME COLUMN "cost_price_ref" TO "cogs";

ALTER TABLE "ProductVariant"
    ALTER COLUMN "cogs" SET DEFAULT 0;

ALTER TABLE "ProductVariant"
    ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "InventoryAudit" (
    "id" SERIAL NOT NULL,
    "audit_code" TEXT NOT NULL,
    "status" "InventoryAuditStatus" NOT NULL DEFAULT 'draft',
    "note" TEXT,
    "account_id" TEXT,
    "account_name" TEXT,
    "counted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAuditLine" (
    "id" SERIAL NOT NULL,
    "audit_id" INTEGER NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "system_on_hand" INTEGER NOT NULL,
    "counted_on_hand" INTEGER,
    "delta_qty" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAuditLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryAudit_audit_code_key" ON "InventoryAudit"("audit_code");
CREATE INDEX "InventoryAudit_status_created_at_idx" ON "InventoryAudit"("status", "created_at" DESC);
CREATE UNIQUE INDEX "InventoryAuditLine_audit_id_product_variant_id_key" ON "InventoryAuditLine"("audit_id", "product_variant_id");
CREATE INDEX "InventoryAuditLine_audit_id_idx" ON "InventoryAuditLine"("audit_id");
CREATE INDEX "InventoryAuditLine_product_variant_id_idx" ON "InventoryAuditLine"("product_variant_id");

ALTER TABLE "InventoryAuditLine"
    ADD CONSTRAINT "InventoryAuditLine_audit_id_fkey"
    FOREIGN KEY ("audit_id") REFERENCES "InventoryAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAuditLine"
    ADD CONSTRAINT "InventoryAuditLine_product_variant_id_fkey"
    FOREIGN KEY ("product_variant_id") REFERENCES "ProductVariant"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryAuditLine"
    ADD CONSTRAINT "InventoryAuditLine_system_on_hand_non_negative" CHECK ("system_on_hand" >= 0),
    ADD CONSTRAINT "InventoryAuditLine_counted_on_hand_non_negative" CHECK ("counted_on_hand" IS NULL OR "counted_on_hand" >= 0);

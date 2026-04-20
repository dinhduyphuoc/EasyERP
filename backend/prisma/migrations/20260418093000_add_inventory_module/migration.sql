CREATE TYPE "InventoryTransactionType" AS ENUM (
    'initialize',
    'adjust',
    'reserve',
    'release',
    'move_to_packing',
    'pack_cancel',
    'fulfill',
    'return_restock',
    'incoming_create',
    'incoming_receive'
);

CREATE TYPE "InventoryReasonCode" AS ENUM (
    'initialize',
    'actual_count',
    'damaged',
    'customer_return',
    'transfer',
    'manufacturing',
    'lost',
    'order_reserved',
    'order_released',
    'packing_started',
    'packing_cancelled',
    'order_fulfilled',
    'purchase_incoming',
    'purchase_received',
    'other'
);

CREATE TYPE "InventoryFieldName" AS ENUM (
    'on_hand',
    'available',
    'committed',
    'packing',
    'incoming'
);

CREATE TABLE "inventory_stocks" (
    "id" SERIAL NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "committed" INTEGER NOT NULL DEFAULT 0,
    "packing" INTEGER NOT NULL DEFAULT 0,
    "incoming" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_transactions" (
    "id" SERIAL NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "transaction_type" "InventoryTransactionType" NOT NULL,
    "reason_code" "InventoryReasonCode" NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "reference_code" TEXT,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "note" TEXT,
    "idempotency_key" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_transaction_lines" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "field_name" "InventoryFieldName" NOT NULL,
    "delta_value" INTEGER NOT NULL,
    "value_after_change" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transaction_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_stocks_product_variant_id_key" ON "inventory_stocks"("product_variant_id");
CREATE UNIQUE INDEX "inventory_transactions_idempotency_key_key" ON "inventory_transactions"("idempotency_key");
CREATE INDEX "inventory_transactions_product_variant_id_created_at_idx" ON "inventory_transactions"("product_variant_id", "created_at" DESC);
CREATE INDEX "inventory_transactions_reference_type_reference_id_idx" ON "inventory_transactions"("reference_type", "reference_id");
CREATE UNIQUE INDEX "inventory_transaction_lines_transaction_id_field_name_key" ON "inventory_transaction_lines"("transaction_id", "field_name");
CREATE INDEX "inventory_transaction_lines_transaction_id_idx" ON "inventory_transaction_lines"("transaction_id");

ALTER TABLE "inventory_stocks"
    ADD CONSTRAINT "inventory_stocks_product_variant_id_fkey"
    FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_product_variant_id_fkey"
    FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_transaction_lines"
    ADD CONSTRAINT "inventory_transaction_lines_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_stocks"
    ADD CONSTRAINT "inventory_stocks_on_hand_non_negative" CHECK ("on_hand" >= 0),
    ADD CONSTRAINT "inventory_stocks_available_non_negative" CHECK ("available" >= 0),
    ADD CONSTRAINT "inventory_stocks_committed_non_negative" CHECK ("committed" >= 0),
    ADD CONSTRAINT "inventory_stocks_packing_non_negative" CHECK ("packing" >= 0),
    ADD CONSTRAINT "inventory_stocks_incoming_non_negative" CHECK ("incoming" >= 0),
    ADD CONSTRAINT "inventory_stocks_bucket_balance" CHECK ("on_hand" = "available" + "committed" + "packing");

ALTER TABLE "inventory_transaction_lines"
    ADD CONSTRAINT "inventory_transaction_lines_value_after_change_non_negative" CHECK ("value_after_change" >= 0);

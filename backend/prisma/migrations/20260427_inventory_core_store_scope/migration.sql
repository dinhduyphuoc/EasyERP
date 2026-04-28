ALTER TABLE "InventoryStock" ADD COLUMN "store_id" TEXT;
ALTER TABLE "InventoryTransaction" ADD COLUMN "store_id" TEXT;

UPDATE "InventoryStock" AS ist
SET "store_id" = src."store_id"
FROM (
  SELECT pv."sku" AS product_variant_id, p."store_id"
  FROM "ProductVariant" AS pv
  JOIN "Product" AS p ON p."id" = pv."product_id"
) AS src
WHERE ist."product_variant_id" = src."product_variant_id"
  AND ist."store_id" IS NULL;

UPDATE "InventoryTransaction" AS itx
SET "store_id" = src."store_id"
FROM (
  SELECT pv."sku" AS product_variant_id, p."store_id"
  FROM "ProductVariant" AS pv
  JOIN "Product" AS p ON p."id" = pv."product_id"
) AS src
WHERE itx."product_variant_id" = src."product_variant_id"
  AND itx."store_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "InventoryStock" WHERE "store_id" IS NULL) THEN
    RAISE EXCEPTION 'InventoryStock contains rows without resolvable store_id';
  END IF;

  IF EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE "store_id" IS NULL) THEN
    RAISE EXCEPTION 'InventoryTransaction contains rows without resolvable store_id';
  END IF;
END $$;

ALTER TABLE "InventoryStock" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "InventoryTransaction" ALTER COLUMN "store_id" SET NOT NULL;

CREATE INDEX "InventoryStock_store_id_idx" ON "InventoryStock"("store_id");
CREATE INDEX "InventoryTransaction_store_id_created_at_idx" ON "InventoryTransaction"("store_id", "created_at" DESC);

ALTER TABLE "InventoryStock"
ADD CONSTRAINT "InventoryStock_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryTransaction"
ADD CONSTRAINT "InventoryTransaction_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAudit" ADD COLUMN "store_id" TEXT;

UPDATE "InventoryAudit" AS ia
SET "store_id" = src."store_id"
FROM (
  SELECT ial."audit_id", MIN(p."store_id") AS "store_id"
  FROM "InventoryAuditLine" AS ial
  JOIN "ProductVariant" AS pv ON pv."sku" = ial."product_variant_id"
  JOIN "Product" AS p ON p."id" = pv."product_id"
  GROUP BY ial."audit_id"
) AS src
WHERE ia."id" = src."audit_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "InventoryAudit"
    WHERE "store_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'InventoryAudit contains rows without resolvable store_id';
  END IF;
END $$;

ALTER TABLE "InventoryAudit" ALTER COLUMN "store_id" SET NOT NULL;

CREATE INDEX "InventoryAudit_store_id_idx" ON "InventoryAudit"("store_id");

ALTER TABLE "InventoryAudit"
ADD CONSTRAINT "InventoryAudit_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

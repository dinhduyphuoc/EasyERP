ALTER TABLE "ProductVariant" ADD COLUMN "store_id" TEXT;

UPDATE "ProductVariant" AS pv
SET "store_id" = p."store_id"
FROM "Product" AS p
WHERE p."id" = pv."product_id"
  AND pv."store_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProductVariant" WHERE "store_id" IS NULL) THEN
    RAISE EXCEPTION 'ProductVariant contains rows without resolvable store_id';
  END IF;
END $$;

ALTER TABLE "ProductVariant" ALTER COLUMN "store_id" SET NOT NULL;

CREATE INDEX "ProductVariant_store_id_idx" ON "ProductVariant"("store_id");
CREATE INDEX "ProductVariant_store_id_status_idx" ON "ProductVariant"("store_id", "status");

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

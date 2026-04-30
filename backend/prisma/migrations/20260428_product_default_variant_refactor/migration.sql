ALTER TABLE "Product" ADD COLUMN "default_variant_sku" TEXT;

UPDATE "Product"
SET "default_variant_sku" = "sku"
WHERE "default_variant_sku" IS NULL;

CREATE TYPE "ProductVariantKind" AS ENUM ('default', 'generated');

ALTER TABLE "ProductVariant" ADD COLUMN "kind" "ProductVariantKind";

UPDATE "ProductVariant" AS pv
SET "kind" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "VariantAttributeValue" AS vav
    WHERE vav."variant_sku" = pv."sku"
  ) THEN 'generated'::"ProductVariantKind"
  ELSE 'default'::"ProductVariantKind"
END
WHERE pv."kind" IS NULL;

ALTER TABLE "ProductVariant" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "ProductVariant" ALTER COLUMN "kind" SET DEFAULT 'generated';

DROP INDEX IF EXISTS "Product_store_id_sku_key";
CREATE INDEX "Product_default_variant_sku_idx" ON "Product"("default_variant_sku");
CREATE INDEX "ProductVariant_product_id_kind_status_idx" ON "ProductVariant"("product_id", "kind", "status");

ALTER TABLE "Product" DROP COLUMN "sku";

CREATE TYPE "ProductStatus" AS ENUM (
    'active',
    'inactive',
    'draft'
);

ALTER TABLE "Product"
    ADD COLUMN "status_new" "ProductStatus" NOT NULL DEFAULT 'draft';

UPDATE "Product"
SET "status_new" = CASE
    WHEN "status" = 'inactive' THEN 'inactive'::"ProductStatus"
    WHEN "status" = 'draft' THEN 'draft'::"ProductStatus"
    WHEN "status" = 'active' THEN 'active'::"ProductStatus"
    WHEN "status" IS NULL THEN 'draft'::"ProductStatus"
    ELSE 'active'::"ProductStatus"
END;

ALTER TABLE "Product" DROP COLUMN "status";
ALTER TABLE "Product" RENAME COLUMN "status_new" TO "status";

CREATE TYPE "StoreRole" AS ENUM ('owner', 'admin', 'staff');

CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "default_currency" TEXT NOT NULL DEFAULT 'USD',
    "default_timezone" TEXT NOT NULL DEFAULT 'UTC',
    "default_address_json" JSONB NOT NULL DEFAULT '{}',
    "billing_address_json" JSONB NOT NULL DEFAULT '{}',
    "return_address_json" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserStore" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "role" "StoreRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserStore_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "active_store_id" TEXT;
ALTER TABLE "Category" ADD COLUMN "store_id" TEXT;
ALTER TABLE "CustomerCategory" ADD COLUMN "store_id" TEXT;
ALTER TABLE "Customer" ADD COLUMN "store_id" TEXT;
ALTER TABLE "Order" ADD COLUMN "store_id" TEXT;
ALTER TABLE "Product" ADD COLUMN "store_id" TEXT;

INSERT INTO "Store" (
    "id",
    "tenant_id",
    "name",
    "slug",
    "owner_user_id",
    "default_currency",
    "default_timezone"
)
SELECT
    md5(random()::text || clock_timestamp()::text || "u"."id"),
    "u"."tenant_id",
    CASE
        WHEN COALESCE(NULLIF(trim("t"."name"), ''), NULL) IS NOT NULL THEN trim("t"."name") || ' Store'
        WHEN COALESCE(NULLIF(trim("u"."full_name"), ''), NULL) IS NOT NULL THEN trim("u"."full_name") || ' Store'
        ELSE 'Default Store'
    END,
    lower(
        regexp_replace(
            COALESCE(NULLIF(trim("t"."slug"), ''), regexp_replace(trim("u"."email"), '@.*$', ''), 'default-store')
            || '-' || substr("u"."id", 1, 8),
            '[^a-zA-Z0-9]+',
            '-',
            'g'
        )
    ),
    "u"."id",
    'USD',
    'Asia/Saigon'
FROM "User" "u"
LEFT JOIN "Tenant" "t" ON "t"."id" = "u"."tenant_id"
WHERE NOT EXISTS (
    SELECT 1
    FROM "Store" "s"
    WHERE "s"."owner_user_id" = "u"."id"
);

INSERT INTO "UserStore" ("id", "user_id", "store_id", "role")
SELECT
    md5(random()::text || clock_timestamp()::text || "u"."id"),
    "u"."id",
    "s"."id",
    'owner'::"StoreRole"
FROM "User" "u"
JOIN "Store" "s" ON "s"."owner_user_id" = "u"."id"
WHERE NOT EXISTS (
    SELECT 1
    FROM "UserStore" "us"
    WHERE "us"."user_id" = "u"."id"
      AND "us"."store_id" = "s"."id"
);

UPDATE "User" "u"
SET "active_store_id" = "s"."id"
FROM "Store" "s"
WHERE "s"."owner_user_id" = "u"."id"
  AND "u"."active_store_id" IS NULL;

UPDATE "Category"
SET "store_id" = (SELECT "id" FROM "Store" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

UPDATE "CustomerCategory"
SET "store_id" = (SELECT "id" FROM "Store" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

UPDATE "Customer"
SET "store_id" = (SELECT "id" FROM "Store" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

UPDATE "Product"
SET "store_id" = (SELECT "id" FROM "Store" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

UPDATE "Order" "o"
SET "store_id" = COALESCE(
    (SELECT "store_id" FROM "Customer" WHERE "id" = "o"."customer_id"),
    (SELECT "store_id" FROM "Product" "p"
      JOIN "OrderItem" "oi" ON "oi"."product_id" = "p"."id"
      WHERE "oi"."order_id" = "o"."id"
      ORDER BY "oi"."id" ASC
      LIMIT 1
    ),
    (SELECT "active_store_id" FROM "User" ORDER BY "created_at" ASC LIMIT 1)
)
WHERE "o"."store_id" IS NULL;

UPDATE "Category"
SET "store_id" = (SELECT "active_store_id" FROM "User" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

UPDATE "CustomerCategory"
SET "store_id" = (SELECT "active_store_id" FROM "User" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

UPDATE "Customer"
SET "store_id" = (SELECT "active_store_id" FROM "User" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

UPDATE "Product"
SET "store_id" = (SELECT "active_store_id" FROM "User" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

UPDATE "Order"
SET "store_id" = (SELECT "active_store_id" FROM "User" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

ALTER TABLE "Category" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "CustomerCategory" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "store_id" SET NOT NULL;

DROP INDEX IF EXISTS "Product_sku_key";
DROP INDEX IF EXISTS "Customer_client_code_key";
DROP INDEX IF EXISTS "Order_order_code_key";
DROP INDEX IF EXISTS "CustomerCategory_category_code_key";
DROP INDEX IF EXISTS "CustomerCategory_normalized_name_key";

CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");
CREATE INDEX "Store_owner_user_id_idx" ON "Store"("owner_user_id");
CREATE INDEX "Store_tenant_id_idx" ON "Store"("tenant_id");

CREATE UNIQUE INDEX "UserStore_user_id_store_id_key" ON "UserStore"("user_id", "store_id");
CREATE INDEX "UserStore_store_id_idx" ON "UserStore"("store_id");

CREATE INDEX "User_active_store_id_idx" ON "User"("active_store_id");
CREATE INDEX "Category_store_id_idx" ON "Category"("store_id");
CREATE UNIQUE INDEX "Category_store_id_category_name_key" ON "Category"("store_id", "category_name");
CREATE INDEX "CustomerCategory_store_id_idx" ON "CustomerCategory"("store_id");
CREATE UNIQUE INDEX "CustomerCategory_store_id_category_code_key" ON "CustomerCategory"("store_id", "category_code");
CREATE UNIQUE INDEX "CustomerCategory_store_id_normalized_name_key" ON "CustomerCategory"("store_id", "normalized_name");
CREATE INDEX "Customer_store_id_idx" ON "Customer"("store_id");
CREATE UNIQUE INDEX "Customer_store_id_client_code_key" ON "Customer"("store_id", "client_code");
CREATE INDEX "Product_store_id_idx" ON "Product"("store_id");
CREATE UNIQUE INDEX "Product_store_id_sku_key" ON "Product"("store_id", "sku");
CREATE INDEX "Order_store_id_idx" ON "Order"("store_id");
CREATE UNIQUE INDEX "Order_store_id_order_code_key" ON "Order"("store_id", "order_code");

ALTER TABLE "Store"
ADD CONSTRAINT "Store_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Store"
ADD CONSTRAINT "Store_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserStore"
ADD CONSTRAINT "UserStore_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserStore"
ADD CONSTRAINT "UserStore_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User"
ADD CONSTRAINT "User_active_store_id_fkey" FOREIGN KEY ("active_store_id") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Category"
ADD CONSTRAINT "Category_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerCategory"
ADD CONSTRAINT "CustomerCategory_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

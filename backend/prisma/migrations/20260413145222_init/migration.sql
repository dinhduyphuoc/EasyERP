/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- DropTable
DROP TABLE "Post";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "categories" (
    "category_id" TEXT NOT NULL,
    "category_name" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "sales_channels" (
    "channel_id" SERIAL NOT NULL,
    "channel_name" TEXT NOT NULL,

    CONSTRAINT "sales_channels_pkey" PRIMARY KEY ("channel_id")
);

-- CreateTable
CREATE TABLE "order_statuses" (
    "status_id" SERIAL NOT NULL,
    "status_name" TEXT NOT NULL,

    CONSTRAINT "order_statuses_pkey" PRIMARY KEY ("status_id")
);

-- CreateTable
CREATE TABLE "shipping_units" (
    "unit_id" SERIAL NOT NULL,
    "unit_name" TEXT NOT NULL,

    CONSTRAINT "shipping_units_pkey" PRIMARY KEY ("unit_id")
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Đang bán',
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "sku" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "color" TEXT,
    "size" TEXT,
    "image_url" TEXT,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "cost_price_ref" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("sku")
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "display_name" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "locations" (
    "location_id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel_id" INTEGER NOT NULL,
    "status_id" INTEGER NOT NULL,
    "shipping_unit_id" INTEGER NOT NULL,
    "tracking_number" TEXT,
    "shipping_address" TEXT NOT NULL,
    "shipping_fee_system" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_fee_customer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_method" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "order_details" (
    "order_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "order_details_pkey" PRIMARY KEY ("order_id","sku")
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "log_id" SERIAL NOT NULL,
    "batch_id" TEXT,
    "sku" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_number_key" ON "customers"("phone_number");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "sales_channels"("channel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "order_statuses"("status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_unit_id_fkey" FOREIGN KEY ("shipping_unit_id") REFERENCES "shipping_units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_sku_fkey" FOREIGN KEY ("sku") REFERENCES "product_variants"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_sku_fkey" FOREIGN KEY ("sku") REFERENCES "product_variants"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

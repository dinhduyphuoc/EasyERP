-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'inactive', 'draft', 'deleted');

-- CreateEnum
CREATE TYPE "ProductVariantStatus" AS ENUM ('active', 'inactive', 'deleted');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('active', 'inactive', 'soft_deleted', 'deleted');

-- CreateEnum
CREATE TYPE "CustomerGender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('unpaid', 'paid', 'deposit');

-- CreateEnum
CREATE TYPE "OrderProcessingStatus" AS ENUM ('draft', 'placed', 'confirmed', 'picked_up', 'delivering', 'completed', 'cancelled', 'returned');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('sale', 'return');

-- CreateEnum
CREATE TYPE "ShippingConnectionStatus" AS ENUM ('disconnected', 'connected', 'error');

-- CreateEnum
CREATE TYPE "CustomerAddressType" AS ENUM ('billing', 'shipping', 'office', 'warehouse', 'other');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('initialize', 'adjust', 'reserve', 'release', 'move_to_packing', 'pack_cancel', 'fulfill', 'return_restock', 'incoming_create', 'incoming_receive');

-- CreateEnum
CREATE TYPE "InventoryReasonCode" AS ENUM ('initialize', 'actual_count', 'damaged', 'customer_return', 'transfer', 'manufacturing', 'lost', 'order_reserved', 'order_released', 'packing_started', 'packing_cancelled', 'order_fulfilled', 'purchase_incoming', 'purchase_received', 'other');

-- CreateEnum
CREATE TYPE "InventoryFieldName" AS ENUM ('on_hand', 'available', 'committed', 'packing', 'incoming');

-- CreateEnum
CREATE TYPE "InventoryAuditStatus" AS ENUM ('draft', 'completed');

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "category_name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesChannel" (
    "id" SERIAL NOT NULL,
    "channel_name" TEXT NOT NULL,

    CONSTRAINT "SalesChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatus" (
    "id" SERIAL NOT NULL,
    "status_name" TEXT NOT NULL,

    CONSTRAINT "OrderStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingUnit" (
    "id" SERIAL NOT NULL,
    "unit_name" TEXT NOT NULL,

    CONSTRAINT "ShippingUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProvider" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "short_description" TEXT,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "capabilities_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingConnection" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "store_id" TEXT NOT NULL,
    "status" "ShippingConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "credentials_json" JSONB,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingConnectionHistory" (
    "id" SERIAL NOT NULL,
    "connection_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" "ShippingConnectionStatus" NOT NULL,
    "store_id" TEXT NOT NULL,
    "provider_code" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingConnectionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "product_name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT,
    "base_price" DECIMAL(12,2),
    "cogs" DECIMAL(12,2),
    "image_url" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category_id" INTEGER,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attribute" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeValue" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "attribute_id" INTEGER NOT NULL,

    CONSTRAINT "AttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "sku" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "cogs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "image_url" TEXT,
    "status" "ProductVariantStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("sku")
);

-- CreateTable
CREATE TABLE "VariantAttributeValue" (
    "variant_sku" TEXT NOT NULL,
    "attribute_value_id" INTEGER NOT NULL,

    CONSTRAINT "VariantAttributeValue_pkey" PRIMARY KEY ("variant_sku","attribute_value_id")
);

-- CreateTable
CREATE TABLE "CustomerCategory" (
    "id" SERIAL NOT NULL,
    "category_code" TEXT,
    "category_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "client_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "birth_date" TIMESTAMP(3),
    "gender" "CustomerGender",
    "tax_code" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'active',
    "customer_category_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "state_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" SERIAL NOT NULL,
    "city_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" SERIAL NOT NULL,
    "state_id" INTEGER NOT NULL,
    "city_id" INTEGER NOT NULL,
    "district_id" INTEGER,
    "address_line" TEXT NOT NULL,
    "address_line2" TEXT,
    "state_name" TEXT NOT NULL,
    "city_name" TEXT NOT NULL,
    "district_name" TEXT,
    "postal_code" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'VN',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "address_id" INTEGER NOT NULL,
    "type" "CustomerAddressType" NOT NULL DEFAULT 'shipping',
    "label" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "recipient_name" TEXT,
    "recipient_phone" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "order_code" TEXT NOT NULL,
    "order_type" "OrderType" NOT NULL DEFAULT 'sale',
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" INTEGER,
    "customer_code" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_email" TEXT,
    "customer_address" TEXT,
    "client_order_code" TEXT,
    "note" TEXT,
    "required_note" TEXT,
    "payment_type_id" INTEGER,
    "from_address_id" INTEGER,
    "to_address_id" INTEGER,
    "return_address_id" INTEGER,
    "from_name" TEXT,
    "from_phone" TEXT,
    "from_address" TEXT,
    "from_ward_name" TEXT,
    "from_district_name" TEXT,
    "from_province_name" TEXT,
    "return_phone" TEXT,
    "return_address" TEXT,
    "return_district_id" INTEGER,
    "return_ward_code" TEXT,
    "to_ward_code" TEXT,
    "to_district_id" INTEGER,
    "cod_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "content" TEXT,
    "weight" INTEGER,
    "length" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "insurance_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "service_id" INTEGER,
    "service_type_id" INTEGER,
    "pick_station_id" INTEGER,
    "deliver_station_id" INTEGER,
    "coupon" TEXT,
    "pick_shift" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "sub_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_status" "OrderPaymentStatus" NOT NULL DEFAULT 'unpaid',
    "processing_status" "OrderProcessingStatus" NOT NULL DEFAULT 'draft',
    "shipping_service" TEXT,
    "sales_channel" TEXT,
    "order_notes" TEXT,
    "payment_notes" TEXT,
    "warehouse_status" TEXT,
    "tracking_code" TEXT,
    "shipping_status" TEXT,
    "invoice_code" TEXT,
    "created_by" TEXT,
    "confirmed_by" TEXT,
    "status_timeline" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "variant_sku" TEXT,
    "product_name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sub_total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "item_weight" INTEGER,
    "item_length" INTEGER,
    "item_width" INTEGER,
    "item_height" INTEGER,
    "category_level1" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderHistory" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actor_name" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" SERIAL NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "committed" INTEGER NOT NULL DEFAULT 0,
    "packing" INTEGER NOT NULL DEFAULT 0,
    "incoming" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
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
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAuditLine" (
    "id" SERIAL NOT NULL,
    "audit_id" INTEGER NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "system_on_hand" INTEGER NOT NULL,
    "counted_on_hand" INTEGER,
    "delta_qty" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAuditLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransactionLine" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "field_name" "InventoryFieldName" NOT NULL,
    "delta_value" INTEGER NOT NULL,
    "value_after_change" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransactionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProvider_code_key" ON "ShippingProvider"("code");

-- CreateIndex
CREATE INDEX "ShippingProvider_is_active_idx" ON "ShippingProvider"("is_active");

-- CreateIndex
CREATE INDEX "ShippingConnection_store_id_idx" ON "ShippingConnection"("store_id");

-- CreateIndex
CREATE INDEX "ShippingConnection_status_idx" ON "ShippingConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingConnection_provider_id_store_id_key" ON "ShippingConnection"("provider_id", "store_id");

-- CreateIndex
CREATE INDEX "ShippingConnectionHistory_connection_id_created_at_idx" ON "ShippingConnectionHistory"("connection_id", "created_at");

-- CreateIndex
CREATE INDEX "ShippingConnectionHistory_store_id_provider_code_idx" ON "ShippingConnectionHistory"("store_id", "provider_code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCategory_category_code_key" ON "CustomerCategory"("category_code");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCategory_normalized_name_key" ON "CustomerCategory"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_client_code_key" ON "Customer"("client_code");

-- CreateIndex
CREATE INDEX "Customer_full_name_idx" ON "Customer"("full_name");

-- CreateIndex
CREATE INDEX "Customer_client_code_idx" ON "Customer"("client_code");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_tax_code_idx" ON "Customer"("tax_code");

-- CreateIndex
CREATE UNIQUE INDEX "State_code_key" ON "State"("code");

-- CreateIndex
CREATE UNIQUE INDEX "State_normalized_name_key" ON "State"("normalized_name");

-- CreateIndex
CREATE INDEX "City_state_id_idx" ON "City"("state_id");

-- CreateIndex
CREATE UNIQUE INDEX "City_state_id_code_key" ON "City"("state_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "City_state_id_normalized_name_key" ON "City"("state_id", "normalized_name");

-- CreateIndex
CREATE INDEX "District_city_id_idx" ON "District"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "District_city_id_code_key" ON "District"("city_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "District_city_id_normalized_name_key" ON "District"("city_id", "normalized_name");

-- CreateIndex
CREATE INDEX "Address_state_id_idx" ON "Address"("state_id");

-- CreateIndex
CREATE INDEX "Address_city_id_idx" ON "Address"("city_id");

-- CreateIndex
CREATE INDEX "Address_district_id_idx" ON "Address"("district_id");

-- CreateIndex
CREATE INDEX "CustomerAddress_customer_id_idx" ON "CustomerAddress"("customer_id");

-- CreateIndex
CREATE INDEX "CustomerAddress_address_id_idx" ON "CustomerAddress"("address_id");

-- CreateIndex
CREATE INDEX "CustomerAddress_type_idx" ON "CustomerAddress"("type");

-- CreateIndex
CREATE INDEX "CustomerAddress_is_default_idx" ON "CustomerAddress"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAddress_customer_id_address_id_type_key" ON "CustomerAddress"("customer_id", "address_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Order_order_code_key" ON "Order"("order_code");

-- CreateIndex
CREATE INDEX "Order_order_code_idx" ON "Order"("order_code");

-- CreateIndex
CREATE INDEX "Order_order_date_idx" ON "Order"("order_date");

-- CreateIndex
CREATE INDEX "Order_payment_status_idx" ON "Order"("payment_status");

-- CreateIndex
CREATE INDEX "Order_processing_status_idx" ON "Order"("processing_status");

-- CreateIndex
CREATE INDEX "Order_order_type_idx" ON "Order"("order_type");

-- CreateIndex
CREATE INDEX "Order_customer_id_idx" ON "Order"("customer_id");

-- CreateIndex
CREATE INDEX "Order_from_address_id_idx" ON "Order"("from_address_id");

-- CreateIndex
CREATE INDEX "Order_to_address_id_idx" ON "Order"("to_address_id");

-- CreateIndex
CREATE INDEX "Order_return_address_id_idx" ON "Order"("return_address_id");

-- CreateIndex
CREATE INDEX "OrderItem_order_id_idx" ON "OrderItem"("order_id");

-- CreateIndex
CREATE INDEX "OrderItem_product_id_idx" ON "OrderItem"("product_id");

-- CreateIndex
CREATE INDEX "OrderItem_variant_sku_idx" ON "OrderItem"("variant_sku");

-- CreateIndex
CREATE INDEX "OrderHistory_order_id_created_at_idx" ON "OrderHistory"("order_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStock_product_variant_id_key" ON "InventoryStock"("product_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_idempotency_key_key" ON "InventoryTransaction"("idempotency_key");

-- CreateIndex
CREATE INDEX "InventoryTransaction_product_variant_id_created_at_idx" ON "InventoryTransaction"("product_variant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "InventoryTransaction_reference_type_reference_id_idx" ON "InventoryTransaction"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAudit_audit_code_key" ON "InventoryAudit"("audit_code");

-- CreateIndex
CREATE INDEX "InventoryAudit_status_created_at_idx" ON "InventoryAudit"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "InventoryAuditLine_audit_id_idx" ON "InventoryAuditLine"("audit_id");

-- CreateIndex
CREATE INDEX "InventoryAuditLine_product_variant_id_idx" ON "InventoryAuditLine"("product_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAuditLine_audit_id_product_variant_id_key" ON "InventoryAuditLine"("audit_id", "product_variant_id");

-- CreateIndex
CREATE INDEX "InventoryTransactionLine_transaction_id_idx" ON "InventoryTransactionLine"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransactionLine_transaction_id_field_name_key" ON "InventoryTransactionLine"("transaction_id", "field_name");

-- AddForeignKey
ALTER TABLE "ShippingConnection" ADD CONSTRAINT "ShippingConnection_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ShippingProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingConnectionHistory" ADD CONSTRAINT "ShippingConnectionHistory_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "ShippingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_variant_sku_fkey" FOREIGN KEY ("variant_sku") REFERENCES "ProductVariant"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_attribute_value_id_fkey" FOREIGN KEY ("attribute_value_id") REFERENCES "AttributeValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_customer_category_id_fkey" FOREIGN KEY ("customer_category_id") REFERENCES "CustomerCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_from_address_id_fkey" FOREIGN KEY ("from_address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_to_address_id_fkey" FOREIGN KEY ("to_address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_return_address_id_fkey" FOREIGN KEY ("return_address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variant_sku_fkey" FOREIGN KEY ("variant_sku") REFERENCES "ProductVariant"("sku") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderHistory" ADD CONSTRAINT "OrderHistory_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "ProductVariant"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "ProductVariant"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditLine" ADD CONSTRAINT "InventoryAuditLine_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "InventoryAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAuditLine" ADD CONSTRAINT "InventoryAuditLine_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "ProductVariant"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransactionLine" ADD CONSTRAINT "InventoryTransactionLine_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "InventoryTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

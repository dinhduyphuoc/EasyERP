CREATE TYPE "CustomerAddressType" AS ENUM ('billing', 'shipping', 'office', 'warehouse', 'other');

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

ALTER TABLE "Order"
ADD COLUMN "from_address_id" INTEGER,
ADD COLUMN "to_address_id" INTEGER,
ADD COLUMN "return_address_id" INTEGER;

CREATE INDEX "Address_state_id_idx" ON "Address"("state_id");
CREATE INDEX "Address_city_id_idx" ON "Address"("city_id");
CREATE INDEX "Address_district_id_idx" ON "Address"("district_id");

CREATE INDEX "CustomerAddress_customer_id_idx" ON "CustomerAddress"("customer_id");
CREATE INDEX "CustomerAddress_address_id_idx" ON "CustomerAddress"("address_id");
CREATE INDEX "CustomerAddress_type_idx" ON "CustomerAddress"("type");
CREATE INDEX "CustomerAddress_is_default_idx" ON "CustomerAddress"("is_default");
CREATE UNIQUE INDEX "CustomerAddress_customer_id_address_id_type_key" ON "CustomerAddress"("customer_id", "address_id", "type");

CREATE INDEX "Order_from_address_id_idx" ON "Order"("from_address_id");
CREATE INDEX "Order_to_address_id_idx" ON "Order"("to_address_id");
CREATE INDEX "Order_return_address_id_idx" ON "Order"("return_address_id");

ALTER TABLE "Address" ADD CONSTRAINT "Address_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_from_address_id_fkey" FOREIGN KEY ("from_address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_to_address_id_fkey" FOREIGN KEY ("to_address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_return_address_id_fkey" FOREIGN KEY ("return_address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

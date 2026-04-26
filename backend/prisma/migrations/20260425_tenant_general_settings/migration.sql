ALTER TABLE "Tenant"
ADD COLUMN "default_shipping_address_json" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "default_bank_account_json" JSONB NOT NULL DEFAULT '{}';

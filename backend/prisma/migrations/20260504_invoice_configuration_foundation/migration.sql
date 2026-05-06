ALTER TABLE "Tenant"
ADD COLUMN "default_invoice_settings_json" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "Customer"
ADD COLUMN "invoice_profile_json" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "Order"
ADD COLUMN "invoice_snapshot_json" JSONB NOT NULL DEFAULT '{}'::jsonb;

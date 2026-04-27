DROP INDEX IF EXISTS "InventoryAudit_audit_code_key";

CREATE UNIQUE INDEX "InventoryAudit_store_id_audit_code_key"
ON "InventoryAudit"("store_id", "audit_code");

CREATE INDEX "Order_store_id_tracking_code_idx"
ON "Order"("store_id", "tracking_code");

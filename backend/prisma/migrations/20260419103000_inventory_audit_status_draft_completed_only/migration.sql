UPDATE "InventoryAudit"
SET "status" = 'draft'
WHERE "status" IN ('pending', 'cancelled');

ALTER TYPE "InventoryAuditStatus" RENAME TO "InventoryAuditStatus_old";

CREATE TYPE "InventoryAuditStatus" AS ENUM ('draft', 'completed');

ALTER TABLE "InventoryAudit"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "InventoryAudit"
ALTER COLUMN "status" TYPE "InventoryAuditStatus"
USING (
  CASE
    WHEN "status"::text = 'completed' THEN 'completed'::"InventoryAuditStatus"
    ELSE 'draft'::"InventoryAuditStatus"
  END
);

ALTER TABLE "InventoryAudit"
ALTER COLUMN "status" SET DEFAULT 'draft';

DROP TYPE "InventoryAuditStatus_old";

ALTER TYPE "OrderProcessingStatus" RENAME TO "OrderProcessingStatus_old";

CREATE TYPE "OrderProcessingStatus" AS ENUM (
  'draft',
  'placed',
  'delivering',
  'delivered',
  'completed',
  'cancelled',
  'returned'
);

ALTER TABLE "Order"
ALTER COLUMN "processing_status" DROP DEFAULT;

ALTER TABLE "Order"
ALTER COLUMN "processing_status" TYPE "OrderProcessingStatus"
USING (
  CASE
    WHEN "processing_status"::text = 'confirmed' THEN 'placed'
    WHEN "processing_status"::text = 'picked_up' THEN 'delivering'
    ELSE "processing_status"::text
  END
)::"OrderProcessingStatus";

ALTER TABLE "Order"
ALTER COLUMN "processing_status" SET DEFAULT 'draft';

DROP TYPE "OrderProcessingStatus_old";

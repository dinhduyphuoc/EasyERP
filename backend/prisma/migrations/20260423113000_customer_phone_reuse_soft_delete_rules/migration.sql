ALTER TYPE "CustomerStatus" ADD VALUE IF NOT EXISTS 'soft_deleted';

DROP INDEX IF EXISTS "Customer_phone_key";

ALTER TABLE "Customer"
ALTER COLUMN "phone" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");

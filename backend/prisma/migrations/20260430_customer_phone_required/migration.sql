UPDATE "Customer"
SET "phone" = CONCAT('__archived__missing__', "id"::text)
WHERE "phone" IS NULL;

ALTER TABLE "Customer"
ALTER COLUMN "phone" SET NOT NULL;

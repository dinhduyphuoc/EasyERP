CREATE TYPE "CustomerGender" AS ENUM ('male', 'female', 'other');

ALTER TABLE "Customer"
ADD COLUMN "email" TEXT,
ADD COLUMN "birth_date" TIMESTAMP(3),
ADD COLUMN "gender" "CustomerGender",
ADD COLUMN "tax_code" TEXT;

CREATE INDEX "Customer_email_idx" ON "Customer"("email");
CREATE INDEX "Customer_tax_code_idx" ON "Customer"("tax_code");

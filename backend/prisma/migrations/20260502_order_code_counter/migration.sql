CREATE TABLE "OrderCodeCounter" (
  "store_id" TEXT NOT NULL,
  "last_sequence" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderCodeCounter_pkey" PRIMARY KEY ("store_id"),
  CONSTRAINT "OrderCodeCounter_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrderCodeCounter_updated_at_idx" ON "OrderCodeCounter"("updated_at");

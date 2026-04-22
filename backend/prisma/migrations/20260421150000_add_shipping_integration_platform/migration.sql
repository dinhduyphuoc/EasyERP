CREATE TYPE "ShippingConnectionStatus" AS ENUM (
    'disconnected',
    'connected',
    'error'
);

CREATE TABLE "ShippingProvider" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "short_description" TEXT,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "capabilities_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShippingConnection" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "store_id" TEXT NOT NULL,
    "status" "ShippingConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "credentials_json" JSONB,
    "metadata_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "error_message" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShippingConnectionHistory" (
    "id" SERIAL NOT NULL,
    "connection_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" "ShippingConnectionStatus" NOT NULL,
    "store_id" TEXT NOT NULL,
    "provider_code" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "error_message" TEXT,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingConnectionHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShippingProvider_code_key" ON "ShippingProvider"("code");
CREATE INDEX "ShippingProvider_is_active_idx" ON "ShippingProvider"("is_active");

CREATE UNIQUE INDEX "ShippingConnection_provider_id_store_id_key" ON "ShippingConnection"("provider_id", "store_id");
CREATE INDEX "ShippingConnection_store_id_idx" ON "ShippingConnection"("store_id");
CREATE INDEX "ShippingConnection_status_idx" ON "ShippingConnection"("status");

CREATE INDEX "ShippingConnectionHistory_connection_id_created_at_idx" ON "ShippingConnectionHistory"("connection_id", "created_at");
CREATE INDEX "ShippingConnectionHistory_store_id_provider_code_idx" ON "ShippingConnectionHistory"("store_id", "provider_code");

ALTER TABLE "ShippingConnection"
    ADD CONSTRAINT "ShippingConnection_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "ShippingProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShippingConnectionHistory"
    ADD CONSTRAINT "ShippingConnectionHistory_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "ShippingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

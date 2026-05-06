-- CreateTable
CREATE TABLE "ShippingProviderProvince" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingProviderProvince_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProviderDistrict" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "province_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingProviderDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProviderWard" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "provider_district_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingProviderWard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProviderStateMapping" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "state_id" INTEGER NOT NULL,
    "provider_province_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "confidence_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingProviderStateMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProviderCityMapping" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "city_id" INTEGER NOT NULL,
    "provider_district_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "confidence_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingProviderCityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProviderDistrictMapping" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "provider_ward_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "confidence_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingProviderDistrictMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingProviderProvince_provider_id_idx" ON "ShippingProviderProvince"("provider_id");

-- CreateIndex
CREATE INDEX "ShippingProviderProvince_provider_id_normalized_name_idx" ON "ShippingProviderProvince"("provider_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProviderProvince_provider_id_external_id_key" ON "ShippingProviderProvince"("provider_id", "external_id");

-- CreateIndex
CREATE INDEX "ShippingProviderDistrict_provider_id_idx" ON "ShippingProviderDistrict"("provider_id");

-- CreateIndex
CREATE INDEX "ShippingProviderDistrict_province_id_idx" ON "ShippingProviderDistrict"("province_id");

-- CreateIndex
CREATE INDEX "ShippingProviderDistrict_provider_id_normalized_name_idx" ON "ShippingProviderDistrict"("provider_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProviderDistrict_provider_id_external_id_key" ON "ShippingProviderDistrict"("provider_id", "external_id");

-- CreateIndex
CREATE INDEX "ShippingProviderWard_provider_id_idx" ON "ShippingProviderWard"("provider_id");

-- CreateIndex
CREATE INDEX "ShippingProviderWard_provider_district_id_idx" ON "ShippingProviderWard"("provider_district_id");

-- CreateIndex
CREATE INDEX "ShippingProviderWard_provider_id_normalized_name_idx" ON "ShippingProviderWard"("provider_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProviderWard_provider_id_external_id_key" ON "ShippingProviderWard"("provider_id", "external_id");

-- CreateIndex
CREATE INDEX "ShippingProviderStateMapping_state_id_idx" ON "ShippingProviderStateMapping"("state_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProviderStateMapping_provider_id_state_id_key" ON "ShippingProviderStateMapping"("provider_id", "state_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProviderStateMapping_provider_id_provider_province__key" ON "ShippingProviderStateMapping"("provider_id", "provider_province_id");

-- CreateIndex
CREATE INDEX "ShippingProviderCityMapping_city_id_idx" ON "ShippingProviderCityMapping"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProviderCityMapping_provider_id_city_id_key" ON "ShippingProviderCityMapping"("provider_id", "city_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProviderCityMapping_provider_id_provider_district_i_key" ON "ShippingProviderCityMapping"("provider_id", "provider_district_id");

-- CreateIndex
CREATE INDEX "ShippingProviderDistrictMapping_district_id_idx" ON "ShippingProviderDistrictMapping"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProviderDistrictMapping_provider_id_district_id_key" ON "ShippingProviderDistrictMapping"("provider_id", "district_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingProviderDistrictMapping_provider_id_provider_ward_i_key" ON "ShippingProviderDistrictMapping"("provider_id", "provider_ward_id");

-- AddForeignKey
ALTER TABLE "ShippingProviderProvince" ADD CONSTRAINT "ShippingProviderProvince_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ShippingProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderDistrict" ADD CONSTRAINT "ShippingProviderDistrict_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ShippingProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderDistrict" ADD CONSTRAINT "ShippingProviderDistrict_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "ShippingProviderProvince"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderWard" ADD CONSTRAINT "ShippingProviderWard_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ShippingProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderWard" ADD CONSTRAINT "ShippingProviderWard_provider_district_id_fkey" FOREIGN KEY ("provider_district_id") REFERENCES "ShippingProviderDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderStateMapping" ADD CONSTRAINT "ShippingProviderStateMapping_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ShippingProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderStateMapping" ADD CONSTRAINT "ShippingProviderStateMapping_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderStateMapping" ADD CONSTRAINT "ShippingProviderStateMapping_provider_province_id_fkey" FOREIGN KEY ("provider_province_id") REFERENCES "ShippingProviderProvince"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderCityMapping" ADD CONSTRAINT "ShippingProviderCityMapping_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ShippingProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderCityMapping" ADD CONSTRAINT "ShippingProviderCityMapping_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderCityMapping" ADD CONSTRAINT "ShippingProviderCityMapping_provider_district_id_fkey" FOREIGN KEY ("provider_district_id") REFERENCES "ShippingProviderDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderDistrictMapping" ADD CONSTRAINT "ShippingProviderDistrictMapping_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ShippingProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderDistrictMapping" ADD CONSTRAINT "ShippingProviderDistrictMapping_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingProviderDistrictMapping" ADD CONSTRAINT "ShippingProviderDistrictMapping_provider_ward_id_fkey" FOREIGN KEY ("provider_ward_id") REFERENCES "ShippingProviderWard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

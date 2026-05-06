import { prisma } from "@lib/prisma";
import { Prisma } from "../../../generated/prisma/client";

export type ShippingTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const ShippingRepository = {
  findProviderByCodeBasic: (providerCode: string) =>
    prisma.shippingProvider.findUnique({
      where: { code: providerCode.toLowerCase() },
      select: { id: true, code: true, display_name: true },
    }),

  findConnectionByProviderAndStoreBasic: (providerId: number, storeId: string) =>
    prisma.shippingConnection.findUnique({
      where: {
        provider_id_store_id: {
          provider_id: providerId,
          store_id: storeId,
        },
      },
      select: {
        status: true,
        credentials_json: true,
      },
    }),

  findOrdersByTrackingCode: (trackingCode: string) =>
    prisma.order.findMany({
      where: { tracking_code: trackingCode },
      select: {
        id: true,
        store_id: true,
        order_code: true,
        tracking_code: true,
        processing_status: true,
      },
    }),

  findProviderIdByCode: (providerCode: string) =>
    prisma.shippingProvider.findUnique({
      where: { code: providerCode.toLowerCase() },
      select: { id: true },
    }),

  findConnectedStoreConnectionsByProviderAndStores: (providerId: number, storeIds: string[]) =>
    prisma.shippingConnection.findMany({
      where: {
        provider_id: providerId,
        store_id: { in: storeIds },
        status: "connected",
      },
      select: {
        store_id: true,
        credentials_json: true,
      },
    }),

  upsertProviderCatalogEntry: (adapter: {
    definition: {
      code: string;
      display_name: string;
      short_description: string | null;
      logo_url: string | null;
      capabilities: Record<string, unknown>;
    };
  }) =>
    prisma.shippingProvider.upsert({
      where: { code: adapter.definition.code },
      update: {
        display_name: adapter.definition.display_name,
        short_description: adapter.definition.short_description,
        logo_url: adapter.definition.logo_url,
        is_active: true,
        capabilities_json: adapter.definition.capabilities as Prisma.InputJsonObject,
      },
      create: {
        code: adapter.definition.code,
        display_name: adapter.definition.display_name,
        short_description: adapter.definition.short_description,
        logo_url: adapter.definition.logo_url,
        is_active: true,
        capabilities_json: adapter.definition.capabilities as Prisma.InputJsonObject,
      },
    }),

  findProviderByCode: (providerCode: string) =>
    prisma.shippingProvider.findUnique({
      where: { code: providerCode.toLowerCase() },
    }),

  findActiveProvidersWithStoreConnections: (storeId: string) =>
    prisma.shippingProvider.findMany({
      where: { is_active: true },
      include: {
        connections: {
          where: { store_id: storeId },
          select: {
            id: true,
            store_id: true,
            status: true,
            error_message: true,
            connected_at: true,
            disconnected_at: true,
            last_verified_at: true,
            updated_at: true,
          },
          take: 1,
        },
      },
      orderBy: [{ display_name: "asc" }],
    }),

  findProviderWithConnectionHistory: (providerCode: string, storeId: string) =>
    prisma.shippingProvider.findUnique({
      where: { code: providerCode.toLowerCase() },
      include: {
        connections: {
          where: { store_id: storeId },
          include: {
            history_items: {
              orderBy: [{ created_at: "desc" }],
              take: 8,
            },
          },
          take: 1,
        },
      },
    }),

  findConnectionByProviderAndStore: (providerId: number, storeId: string) =>
    prisma.shippingConnection.findUnique({
      where: {
        provider_id_store_id: {
          provider_id: providerId,
          store_id: storeId,
        },
      },
    }),

  updateConnection: (connectionId: number, data: Prisma.ShippingConnectionUpdateInput) =>
    prisma.shippingConnection.update({
      where: { id: connectionId },
      data,
    }),

  createConnection: (data: Prisma.ShippingConnectionUncheckedCreateInput) =>
    prisma.shippingConnection.create({
      data,
    }),

  createConnectionHistory: (data: Prisma.ShippingConnectionHistoryUncheckedCreateInput) =>
    prisma.shippingConnectionHistory.create({
      data,
    }),

  withTransaction: <T>(fn: (tx: ShippingTransaction) => Promise<T>) =>
    prisma.$transaction(fn),

  updateOrderInTx: (tx: ShippingTransaction, orderId: number, data: Prisma.OrderUpdateInput) =>
    tx.order.update({
      where: { id: orderId },
      data,
    }),

  createOrderHistoryInTx: (tx: ShippingTransaction, data: Prisma.OrderHistoryUncheckedCreateInput) =>
    tx.orderHistory.create({
      data,
    }),

  createOrderHistory: (data: Prisma.OrderHistoryUncheckedCreateInput) =>
    prisma.orderHistory.create({
      data,
    }),

  touchConnectionLastSync: (providerId: number, storeId: string) =>
    prisma.shippingConnection.updateMany({
      where: {
        provider_id: providerId,
        store_id: storeId,
        status: "connected",
      },
      data: {
        last_sync_at: new Date(),
      },
    }),

  findAddressWithLocationRefs: (addressId: number) =>
    prisma.address.findUnique({
      where: { id: addressId },
      include: {
        state: {
          select: {
            id: true,
            code: true,
            name: true,
            normalized_name: true,
          },
        },
        city: {
          select: {
            id: true,
            code: true,
            name: true,
            normalized_name: true,
            state_id: true,
          },
        },
        district: {
          select: {
            id: true,
            code: true,
            name: true,
            normalized_name: true,
            city_id: true,
          },
        },
      },
    }),

  findCanonicalLocationRefs: (stateId: number, cityId: number, districtId: number | null) =>
    Promise.all([
      prisma.state.findUnique({
        where: { id: stateId },
        select: {
          id: true,
          code: true,
          name: true,
          normalized_name: true,
        },
      }),
      prisma.city.findUnique({
        where: { id: cityId },
        select: {
          id: true,
          state_id: true,
          code: true,
          name: true,
          normalized_name: true,
        },
      }),
      districtId
        ? prisma.district.findUnique({
            where: { id: districtId },
            select: {
              id: true,
              city_id: true,
              code: true,
              name: true,
              normalized_name: true,
            },
          })
        : Promise.resolve(null),
    ]),

  upsertProviderProvince: (data: {
    providerId: number;
    externalId: string;
    code: string | null;
    name: string;
    normalizedName: string;
    rawPayload: Record<string, unknown>;
    isActive: boolean;
  }) =>
    prisma.shippingProviderProvince.upsert({
      where: {
        provider_id_external_id: {
          provider_id: data.providerId,
          external_id: data.externalId,
        },
      },
      update: {
        code: data.code,
        name: data.name,
        normalized_name: data.normalizedName,
        raw_payload: data.rawPayload as Prisma.InputJsonObject,
        is_active: data.isActive,
      },
      create: {
        provider_id: data.providerId,
        external_id: data.externalId,
        code: data.code,
        name: data.name,
        normalized_name: data.normalizedName,
        raw_payload: data.rawPayload as Prisma.InputJsonObject,
        is_active: data.isActive,
      },
    }),

  deactivateMissingProviderProvinces: (providerId: number, activeExternalIds: string[]) =>
    prisma.shippingProviderProvince.updateMany({
      where: {
        provider_id: providerId,
        external_id: {
          notIn: activeExternalIds,
        },
      },
      data: {
        is_active: false,
      },
    }),

  findActiveProviderProvinces: (providerId: number) =>
    prisma.shippingProviderProvince.findMany({
      where: {
        provider_id: providerId,
        is_active: true,
      },
      orderBy: [{ name: "asc" }],
    }),

  upsertProviderDistrict: (data: {
    providerId: number;
    provinceId: number;
    externalId: string;
    code: string | null;
    name: string;
    normalizedName: string;
    rawPayload: Record<string, unknown>;
    isActive: boolean;
  }) =>
    prisma.shippingProviderDistrict.upsert({
      where: {
        provider_id_external_id: {
          provider_id: data.providerId,
          external_id: data.externalId,
        },
      },
      update: {
        province_id: data.provinceId,
        code: data.code,
        name: data.name,
        normalized_name: data.normalizedName,
        raw_payload: data.rawPayload as Prisma.InputJsonObject,
        is_active: data.isActive,
      },
      create: {
        provider_id: data.providerId,
        province_id: data.provinceId,
        external_id: data.externalId,
        code: data.code,
        name: data.name,
        normalized_name: data.normalizedName,
        raw_payload: data.rawPayload as Prisma.InputJsonObject,
        is_active: data.isActive,
      },
    }),

  deactivateMissingProviderDistricts: (providerId: number, provinceId: number, activeExternalIds: string[]) =>
    prisma.shippingProviderDistrict.updateMany({
      where: {
        provider_id: providerId,
        province_id: provinceId,
        external_id: {
          notIn: activeExternalIds,
        },
      },
      data: {
        is_active: false,
      },
    }),

  findActiveProviderDistricts: (providerId: number, provinceId: number) =>
    prisma.shippingProviderDistrict.findMany({
      where: {
        provider_id: providerId,
        province_id: provinceId,
        is_active: true,
      },
      orderBy: [{ name: "asc" }],
    }),

  upsertProviderWard: (data: {
    providerId: number;
    providerDistrictId: number;
    externalId: string;
    code: string | null;
    name: string;
    normalizedName: string;
    rawPayload: Record<string, unknown>;
    isActive: boolean;
  }) =>
    prisma.shippingProviderWard.upsert({
      where: {
        provider_id_external_id: {
          provider_id: data.providerId,
          external_id: data.externalId,
        },
      },
      update: {
        provider_district_id: data.providerDistrictId,
        code: data.code,
        name: data.name,
        normalized_name: data.normalizedName,
        raw_payload: data.rawPayload as Prisma.InputJsonObject,
        is_active: data.isActive,
      },
      create: {
        provider_id: data.providerId,
        provider_district_id: data.providerDistrictId,
        external_id: data.externalId,
        code: data.code,
        name: data.name,
        normalized_name: data.normalizedName,
        raw_payload: data.rawPayload as Prisma.InputJsonObject,
        is_active: data.isActive,
      },
    }),

  deactivateMissingProviderWards: (providerId: number, providerDistrictId: number, activeExternalIds: string[]) =>
    prisma.shippingProviderWard.updateMany({
      where: {
        provider_id: providerId,
        provider_district_id: providerDistrictId,
        external_id: {
          notIn: activeExternalIds,
        },
      },
      data: {
        is_active: false,
      },
    }),

  findActiveProviderWards: (providerId: number, providerDistrictId: number) =>
    prisma.shippingProviderWard.findMany({
      where: {
        provider_id: providerId,
        provider_district_id: providerDistrictId,
        is_active: true,
      },
      orderBy: [{ name: "asc" }],
    }),

  findStateMapping: (providerId: number, stateId: number) =>
    prisma.shippingProviderStateMapping.findUnique({
      where: {
        provider_id_state_id: {
          provider_id: providerId,
          state_id: stateId,
        },
      },
      include: {
        provider_province: true,
      },
    }),

  upsertStateMapping: (data: {
    providerId: number;
    stateId: number;
    providerProvinceId: number;
    source: string;
    confidenceScore: number;
  }) =>
    prisma.shippingProviderStateMapping.upsert({
      where: {
        provider_id_state_id: {
          provider_id: data.providerId,
          state_id: data.stateId,
        },
      },
      update: {
        provider_province_id: data.providerProvinceId,
        source: data.source,
        confidence_score: data.confidenceScore,
      },
      create: {
        provider_id: data.providerId,
        state_id: data.stateId,
        provider_province_id: data.providerProvinceId,
        source: data.source,
        confidence_score: data.confidenceScore,
      },
      include: {
        provider_province: true,
      },
    }),

  findCityMapping: (providerId: number, cityId: number) =>
    prisma.shippingProviderCityMapping.findUnique({
      where: {
        provider_id_city_id: {
          provider_id: providerId,
          city_id: cityId,
        },
      },
      include: {
        provider_district: true,
      },
    }),

  upsertCityMapping: (data: {
    providerId: number;
    cityId: number;
    providerDistrictId: number;
    source: string;
    confidenceScore: number;
  }) =>
    prisma.shippingProviderCityMapping.upsert({
      where: {
        provider_id_city_id: {
          provider_id: data.providerId,
          city_id: data.cityId,
        },
      },
      update: {
        provider_district_id: data.providerDistrictId,
        source: data.source,
        confidence_score: data.confidenceScore,
      },
      create: {
        provider_id: data.providerId,
        city_id: data.cityId,
        provider_district_id: data.providerDistrictId,
        source: data.source,
        confidence_score: data.confidenceScore,
      },
      include: {
        provider_district: true,
      },
    }),

  findDistrictMapping: (providerId: number, districtId: number) =>
    prisma.shippingProviderDistrictMapping.findUnique({
      where: {
        provider_id_district_id: {
          provider_id: providerId,
          district_id: districtId,
        },
      },
      include: {
        provider_ward: true,
      },
    }),

  upsertDistrictMapping: (data: {
    providerId: number;
    districtId: number;
    providerWardId: number;
    source: string;
    confidenceScore: number;
  }) =>
    prisma.shippingProviderDistrictMapping.upsert({
      where: {
        provider_id_district_id: {
          provider_id: data.providerId,
          district_id: data.districtId,
        },
      },
      update: {
        provider_ward_id: data.providerWardId,
        source: data.source,
        confidence_score: data.confidenceScore,
      },
      create: {
        provider_id: data.providerId,
        district_id: data.districtId,
        provider_ward_id: data.providerWardId,
        source: data.source,
        confidence_score: data.confidenceScore,
      },
      include: {
        provider_ward: true,
      },
    }),
};

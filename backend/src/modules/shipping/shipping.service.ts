import { prisma } from "@lib/prisma";
import { BadRequestError, NotFoundError } from "@/common";
import { createGHNClient } from "@/lib/ghn";
import { Prisma, type ShippingConnectionStatus } from "../../../generated/prisma/client";
import {
  resolveProviderLocationFromCanonical,
} from "./shipping.location.service";
import {
  resolveShippingAdapter,
  shippingProviderAdapters,
} from "./shipping.adapters";
import type {
  GHNOrderStatusCallbackPayload,
  GHNTicketCallbackPayload,
  ShippingAddressDistrictQuery,
  ShippingAddressWardQuery,
  ShippingAvailableServicesInput,
  ShippingAvailableServicesByLocationInput,
  ShippingConnectInput,
  ShippingDisconnectInput,
  ShippingFeeQuoteInput,
  ShippingFeeQuoteByLocationInput,
  ShippingLocationResolveInput,
  ShippingVerifyInput,
} from "./shipping.types";

const STATUS_LABELS: Record<ShippingConnectionStatus, string> = {
  disconnected: "Chưa liên kết",
  connected: "Đã liên kết",
  error: "Lỗi",
};

const parseRequiredPositiveInt = (value: unknown, fieldName: string) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

const parseOptionalNonNegativeInt = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestError(`${fieldName} must be a non-negative integer`);
  }

  return parsed;
};

const getConnectedProviderClient = async (
  providerCode: string,
  storeId: string,
) => {
  const provider = await prisma.shippingProvider.findUnique({
    where: { code: providerCode.toLowerCase() },
    select: { id: true, code: true, display_name: true },
  });

  if (!provider) {
    throw new NotFoundError("Shipping provider not found");
  }

  const connection = await prisma.shippingConnection.findUnique({
    where: {
      provider_id_store_id: {
        provider_id: provider.id,
        store_id: storeId,
      },
    },
    select: {
      status: true,
      credentials_json: true,
    },
  });

  if (!connection || connection.status !== "connected") {
    throw new BadRequestError(
      `${provider.display_name} connection is not available for store ${storeId}`,
    );
  }

  if (
    !connection.credentials_json ||
    typeof connection.credentials_json !== "object" ||
    Array.isArray(connection.credentials_json)
  ) {
    throw new BadRequestError(`${provider.display_name} credentials are missing`);
  }

  const adapter = resolveShippingAdapter(provider.code);
  const credentials = adapter.validateCredentials(
    connection.credentials_json as Record<string, unknown>,
  );

  switch (provider.code) {
    case "ghn":
      return {
        store_id: storeId,
        provider,
        client: createGHNClient({
          token: credentials.token,
          shopId: credentials.shop_id,
        }),
        credentials,
      };
    default:
      throw new BadRequestError(
        `Connected provider ${provider.display_name} does not support address or fee integration yet`,
      );
  }
};

const ensurePlainObject = (value: unknown): Record<string, unknown> => {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("metadata must be an object");
  }

  return value as Record<string, unknown>;
};

const ensureCredentialsObject = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("credentials must be an object");
  }

  return value as Record<string, unknown>;
};

const toJsonObject = (value: Record<string, unknown>): Prisma.InputJsonObject => {
  return value as Prisma.InputJsonObject;
};

const buildStatusMeta = (status: ShippingConnectionStatus) => ({
  code: status,
  label: STATUS_LABELS[status],
});

const mapGHNStatusToProcessingStatus = (status: string | undefined) => {
  const normalized = status?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["ready_to_pick"].includes(normalized)) {
    return "confirmed" as const;
  }

  if (["picking", "picked", "storing", "money_collect_picking", "sorting"].includes(normalized)) {
    return "picked_up" as const;
  }

  if (["delivering", "transporting", "waiting_to_return"].includes(normalized)) {
    return "delivering" as const;
  }

  if (["delivered"].includes(normalized)) {
    return "completed" as const;
  }

  if (["cancel", "cancelled"].includes(normalized)) {
    return "cancelled" as const;
  }

  if (["return", "returned", "return_transporting", "return_sorting"].includes(normalized)) {
    return "returned" as const;
  }

  return undefined;
};

const toOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toOptionalPositiveInt = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const mergeMetadata = (
  currentValue: Prisma.JsonValue | null | undefined,
  nextValue: Record<string, unknown>,
) => {
  const currentObject =
    currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
      ? (currentValue as Record<string, unknown>)
      : {};

  return {
    ...currentObject,
    ...nextValue,
  };
};

const resolveGHNWebhookOrder = async (trackingCode: string, shopIdInput?: number | null) => {
  const candidateOrders = await prisma.order.findMany({
    where: { tracking_code: trackingCode },
    select: {
      id: true,
      store_id: true,
      order_code: true,
      tracking_code: true,
      processing_status: true,
    },
  });

  if (candidateOrders.length === 0) {
    return null;
  }

  if (candidateOrders.length === 1 && !shopIdInput) {
    return candidateOrders[0];
  }

  const ghnProvider = await prisma.shippingProvider.findUnique({
    where: { code: "ghn" },
    select: { id: true },
  });

  if (!ghnProvider) {
    return null;
  }

  const connections = await prisma.shippingConnection.findMany({
    where: {
      provider_id: ghnProvider.id,
      store_id: { in: candidateOrders.map((order) => order.store_id) },
      status: "connected",
    },
    select: {
      store_id: true,
      credentials_json: true,
    },
  });

  const matchedStoreIds = new Set(
    connections
      .filter((connection) => {
        if (
          !connection.credentials_json ||
          typeof connection.credentials_json !== "object" ||
          Array.isArray(connection.credentials_json)
        ) {
          return false;
        }

        const credentials = connection.credentials_json as Record<string, unknown>;
        const connectionShopId = toOptionalPositiveInt(credentials.shop_id);

        if (shopIdInput) {
          return connectionShopId === shopIdInput;
        }

        return connectionShopId !== null;
      })
      .map((connection) => connection.store_id),
  );

  const matchedOrders = candidateOrders.filter((order) => matchedStoreIds.has(order.store_id));

  if (shopIdInput) {
    return matchedOrders.length === 1 ? matchedOrders[0] : null;
  }

  return matchedOrders.length === 1 ? matchedOrders[0] : null;
};

const syncProviderCatalog = async () => {
  await Promise.all(
    shippingProviderAdapters.map((adapter) =>
      prisma.shippingProvider.upsert({
        where: { code: adapter.definition.code },
        update: {
          display_name: adapter.definition.display_name,
          short_description: adapter.definition.short_description,
          logo_url: adapter.definition.logo_url,
          is_active: true,
          capabilities_json: toJsonObject(adapter.definition.capabilities),
        },
        create: {
          code: adapter.definition.code,
          display_name: adapter.definition.display_name,
          short_description: adapter.definition.short_description,
          logo_url: adapter.definition.logo_url,
          is_active: true,
          capabilities_json: toJsonObject(adapter.definition.capabilities),
        },
      }),
    ),
  );
};

const getProviderOrThrow = async (providerCode: string) => {
  const provider = await prisma.shippingProvider.findUnique({
    where: { code: providerCode.toLowerCase() },
  });

  if (!provider) {
    throw new NotFoundError("Shipping provider not found");
  }

  return provider;
};

const serializeProviderSummary = (
  provider: {
    id: number;
    code: string;
    display_name: string;
    short_description: string | null;
    logo_url: string | null;
    capabilities_json: Prisma.JsonValue;
  },
  connection:
    | {
        id: number;
        store_id: string;
        status: ShippingConnectionStatus;
        error_message: string | null;
        connected_at: Date | null;
        disconnected_at: Date | null;
        last_verified_at: Date | null;
        updated_at: Date;
      }
    | undefined,
) => {
  const adapter = resolveShippingAdapter(provider.code);
  const status = connection?.status ?? "disconnected";

  return {
    id: provider.id,
    code: provider.code,
    display_name: provider.display_name,
    short_description: provider.short_description,
    logo_url: provider.logo_url,
    status: buildStatusMeta(status),
    error_message: connection?.error_message ?? null,
    connected_at: connection?.connected_at?.toISOString() ?? null,
    disconnected_at: connection?.disconnected_at?.toISOString() ?? null,
    last_verified_at: connection?.last_verified_at?.toISOString() ?? null,
    updated_at: connection?.updated_at.toISOString() ?? null,
    credential_fields: adapter.definition.credential_fields,
    capabilities: adapter.definition.capabilities,
  };
};

const serializeConnectionDetail = (
  provider: {
    id: number;
    code: string;
    display_name: string;
    short_description: string | null;
    logo_url: string | null;
    capabilities_json: Prisma.JsonValue;
  },
  storeId: string,
  connection:
    | ({
        id: number;
        store_id: string;
        status: ShippingConnectionStatus;
        credentials_json: Prisma.JsonValue | null;
        metadata_json: Prisma.JsonValue;
        error_message: string | null;
        last_sync_at: Date | null;
        last_verified_at: Date | null;
        connected_at: Date | null;
        disconnected_at: Date | null;
        created_at: Date;
        updated_at: Date;
        history_items: Array<{
          id: number;
          action: string;
          status: ShippingConnectionStatus;
          payload_json: Prisma.JsonValue;
          error_message: string | null;
          actor_id: string | null;
          actor_name: string | null;
          created_at: Date;
        }>;
      })
    | null,
) => {
  const adapter = resolveShippingAdapter(provider.code);
  const maskedCredentials =
    connection?.credentials_json && typeof connection.credentials_json === "object" && !Array.isArray(connection.credentials_json)
      ? adapter.maskCredentials(connection.credentials_json as Record<string, unknown>)
      : {};

  const metadata =
    connection?.metadata_json && typeof connection.metadata_json === "object" && !Array.isArray(connection.metadata_json)
      ? (connection.metadata_json as Record<string, unknown>)
      : {};

  return {
    provider: {
      id: provider.id,
      code: provider.code,
      display_name: provider.display_name,
      short_description: provider.short_description,
      logo_url: provider.logo_url,
      credential_fields: adapter.definition.credential_fields,
      capabilities: adapter.definition.capabilities,
    },
    connection: connection
      ? {
          id: connection.id,
          store_id: connection.store_id,
          status: buildStatusMeta(connection.status),
          has_credentials: Object.keys(maskedCredentials).length > 0,
          masked_credentials: maskedCredentials,
          metadata,
          error_message: connection.error_message,
          last_sync_at: connection.last_sync_at?.toISOString() ?? null,
          last_verified_at: connection.last_verified_at?.toISOString() ?? null,
          connected_at: connection.connected_at?.toISOString() ?? null,
          disconnected_at: connection.disconnected_at?.toISOString() ?? null,
          created_at: connection.created_at.toISOString(),
          updated_at: connection.updated_at.toISOString(),
          history_items: connection.history_items.map((item) => ({
            id: item.id,
            action: item.action,
            status: buildStatusMeta(item.status),
            payload: item.payload_json,
            error_message: item.error_message,
            actor_id: item.actor_id,
            actor_name: item.actor_name,
            created_at: item.created_at.toISOString(),
          })),
        }
      : {
          id: null,
          store_id: storeId,
          status: buildStatusMeta("disconnected"),
          has_credentials: false,
          masked_credentials: {},
          metadata: {},
          error_message: null,
          last_sync_at: null,
          last_verified_at: null,
          connected_at: null,
          disconnected_at: null,
          created_at: null,
          updated_at: null,
          history_items: [],
        },
  };
};

export const ShippingService = {
  listProviders: async (storeId: string) => {
    await syncProviderCatalog();

    const providers = await prisma.shippingProvider.findMany({
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
    });

    return {
      store_id: storeId,
      items: providers.map((provider) =>
        serializeProviderSummary(provider, provider.connections[0]),
      ),
    };
  },

  getConnectionDetail: async (providerCode: string, storeId: string) => {
    await syncProviderCatalog();

    const provider = await prisma.shippingProvider.findUnique({
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
    });

    if (!provider) {
      throw new NotFoundError("Shipping provider not found");
    }

    return serializeConnectionDetail(provider, storeId, provider.connections[0] ?? null);
  },

  listProviderProvinces: async (providerCode: string, storeId: string) => {
    const { client, provider, store_id } = await getConnectedProviderClient(providerCode, storeId);

    switch (provider.code) {
      case "ghn": {
        const response = await client.address.getProvince();
        return {
          store_id,
          provider_code: provider.code,
          items:
            response.data?.map((item: any) => ({
              id: item.ProvinceID,
              code: item.Code,
              name: item.ProvinceName,
            })) ?? [],
        };
      }
      default:
        throw new BadRequestError(
          `Provider ${provider.display_name} does not support province lookup`,
        );
    }
  },

  listProviderDistricts: async (
    providerCode: string,
    storeId: string,
    query: ShippingAddressDistrictQuery,
  ) => {
    const { client, provider, store_id } = await getConnectedProviderClient(providerCode, storeId);
    const provinceId = parseRequiredPositiveInt(query.province_id, "province_id");

    switch (provider.code) {
      case "ghn": {
        const response = await client.address.getDistrict({
          province_id: provinceId,
        });
        return {
          store_id,
          provider_code: provider.code,
          province_id: provinceId,
          items:
            response.data?.map((item: any) => ({
              id: item.DistrictID,
              province_id: item.ProvinceID,
              code: item.Code,
              name: item.DistrictName,
            })) ?? [],
        };
      }
      default:
        throw new BadRequestError(
          `Provider ${provider.display_name} does not support district lookup`,
        );
    }
  },

  listProviderWards: async (
    providerCode: string,
    storeId: string,
    query: ShippingAddressWardQuery,
  ) => {
    const { client, provider, store_id } = await getConnectedProviderClient(providerCode, storeId);
    const districtId = parseRequiredPositiveInt(query.district_id, "district_id");

    switch (provider.code) {
      case "ghn": {
        const response = await client.address.getWard({
          district_id: districtId,
        });
        return {
          store_id,
          provider_code: provider.code,
          district_id: districtId,
          items:
            response.data?.map((item: any) => ({
              code: item.WardCode,
              district_id: item.DistrictID,
              name: item.WardName,
            })) ?? [],
        };
      }
      default:
        throw new BadRequestError(
          `Provider ${provider.display_name} does not support ward lookup`,
        );
    }
  },

  resolveProviderLocation: async (
    providerCode: string,
    storeId: string,
    input: ShippingLocationResolveInput,
  ) => {
    const { client, provider, store_id } = await getConnectedProviderClient(providerCode, storeId);

    switch (provider.code) {
      case "ghn": {
        const resolved = await resolveProviderLocationFromCanonical(
          {
            client,
            provider,
            store_id,
          },
          input.location,
        );

        return {
          store_id,
          provider_code: provider.code,
          location: resolved,
        };
      }
      default:
        throw new BadRequestError(
          `Provider ${provider.display_name} does not support canonical location mapping yet`,
        );
    }
  },

  listAvailableServices: async (
    providerCode: string,
    storeId: string,
    input: ShippingAvailableServicesInput,
  ) => {
    const { client, provider, store_id, credentials } = await getConnectedProviderClient(providerCode, storeId);
    const fromDistrictId = parseRequiredPositiveInt(
      input.from_district_id,
      "from_district_id",
    );
    const toDistrictId = parseRequiredPositiveInt(
      input.to_district_id,
      "to_district_id",
    );

    switch (provider.code) {
      case "ghn": {
        const response = await client.fee.getAvailableService({
          shop_id: Number(credentials.shop_id),
          from_district: fromDistrictId,
          to_district: toDistrictId,
        });

        return {
          store_id,
          provider_code: provider.code,
          items:
            response.data?.map((item: any) => ({
              service_id: item.service_id,
              service_type_id: item.service_type_id,
              short_name: item.short_name,
            })) ?? [],
        };
      }
      default:
        throw new BadRequestError(
          `Provider ${provider.display_name} does not support service lookup`,
        );
    }
  },

  listAvailableServicesByLocation: async (
    providerCode: string,
    storeId: string,
    input: ShippingAvailableServicesByLocationInput,
  ) => {
    const { client, provider, store_id, credentials } = await getConnectedProviderClient(providerCode, storeId);

    switch (provider.code) {
      case "ghn": {
        if (!input.from_location) {
          throw new BadRequestError("from_location is required");
        }

        if (!input.to_location) {
          throw new BadRequestError("to_location is required");
        }

        const [resolvedFrom, resolvedTo] = await Promise.all([
          resolveProviderLocationFromCanonical(
            {
              client,
              provider,
              store_id,
            },
            input.from_location,
          ),
          resolveProviderLocationFromCanonical(
            {
              client,
              provider,
              store_id,
            },
            input.to_location,
          ),
        ]);

        const response = await client.fee.getAvailableService({
          shop_id: Number(credentials.shop_id),
          from_district: parseRequiredPositiveInt(
            resolvedFrom.provider_district.external_id,
            "from provider district external_id",
          ),
          to_district: parseRequiredPositiveInt(
            resolvedTo.provider_district.external_id,
            "to provider district external_id",
          ),
        });

        return {
          store_id,
          provider_code: provider.code,
          resolved_from: resolvedFrom,
          resolved_to: resolvedTo,
          items:
            response.data?.map((item: any) => ({
              service_id: item.service_id,
              service_type_id: item.service_type_id,
              short_name: item.short_name,
            })) ?? [],
        };
      }
      default:
        throw new BadRequestError(
          `Provider ${provider.display_name} does not support canonical service lookup yet`,
        );
    }
  },

  calculateFee: async (providerCode: string, storeId: string, input: ShippingFeeQuoteInput) => {
    const { client, provider, store_id } = await getConnectedProviderClient(providerCode, storeId);

    switch (provider.code) {
      case "ghn": {
        const toDistrictId = parseRequiredPositiveInt(
          input.to_district_id,
          "to_district_id",
        );
        const toWardCode =
          typeof input.to_ward_code === "string" ? input.to_ward_code.trim() : "";

        if (!toWardCode) {
          throw new BadRequestError("to_ward_code is required");
        }

        const response = await client.fee.calculateFee({
          from_district_id: parseOptionalNonNegativeInt(
            input.from_district_id,
            "from_district_id",
          ),
          from_ward_code:
            typeof input.from_ward_code === "string" && input.from_ward_code.trim()
              ? input.from_ward_code.trim()
              : undefined,
          service_id: parseOptionalNonNegativeInt(input.service_id, "service_id"),
          service_type_id: parseOptionalNonNegativeInt(
            input.service_type_id,
            "service_type_id",
          ),
          to_district_id: toDistrictId,
          to_ward_code: toWardCode,
          height: parseOptionalNonNegativeInt(input.height, "height"),
          length: parseOptionalNonNegativeInt(input.length, "length"),
          weight: parseOptionalNonNegativeInt(input.weight, "weight"),
          width: parseOptionalNonNegativeInt(input.width, "width"),
          insurance_value: parseOptionalNonNegativeInt(
            input.insurance_value,
            "insurance_value",
          ),
          cod_value: parseOptionalNonNegativeInt(input.cod_value, "cod_value"),
          coupon:
            typeof input.coupon === "string" && input.coupon.trim()
              ? input.coupon.trim()
              : undefined,
          items: Array.isArray(input.items)
            ? input.items.map((item, index) => ({
                name: typeof item.name === "string" && item.name.trim()
                  ? item.name.trim()
                  : `Item ${index + 1}`,
                quantity: parseRequiredPositiveInt(item.quantity ?? 1, `items[${index}].quantity`),
                height: parseOptionalNonNegativeInt(item.height, `items[${index}].height`),
                weight: parseOptionalNonNegativeInt(item.weight, `items[${index}].weight`),
                length: parseOptionalNonNegativeInt(item.length, `items[${index}].length`),
                width: parseOptionalNonNegativeInt(item.width, `items[${index}].width`),
              }))
            : undefined,
        });

        return {
          store_id,
          provider_code: provider.code,
          quote: response.data,
        };
      }
      default:
        throw new BadRequestError(
          `Provider ${provider.display_name} does not support fee calculation`,
        );
    }
  },

  calculateFeeByLocation: async (
    providerCode: string,
    storeId: string,
    input: ShippingFeeQuoteByLocationInput,
  ) => {
    const { client, provider, store_id, credentials } = await getConnectedProviderClient(providerCode, storeId);

    switch (provider.code) {
      case "ghn": {
        if (!input.from_location) {
          throw new BadRequestError("from_location is required");
        }

        if (!input.to_location) {
          throw new BadRequestError("to_location is required");
        }

        const [resolvedFrom, resolvedTo] = await Promise.all([
          resolveProviderLocationFromCanonical(
            {
              client,
              provider,
              store_id,
            },
            input.from_location,
            { require_district: true },
          ),
          resolveProviderLocationFromCanonical(
            {
              client,
              provider,
              store_id,
            },
            input.to_location,
            { require_district: true },
          ),
        ]);

        const fromWardCode =
          resolvedFrom.provider_ward?.code?.trim() ??
          resolvedFrom.provider_ward?.external_id ??
          null;
        const toWardCode =
          resolvedTo.provider_ward?.code?.trim() ??
          resolvedTo.provider_ward?.external_id ??
          null;

        if (!fromWardCode || !toWardCode) {
          throw new BadRequestError(
            "Both from_location and to_location must resolve to a provider ward",
          );
        }

        let resolvedServiceId = parseOptionalNonNegativeInt(
          input.service_id,
          "service_id",
        );
        let resolvedServiceTypeId = parseOptionalNonNegativeInt(
          input.service_type_id,
          "service_type_id",
        );
        let appliedService:
          | {
              service_id: number;
              service_type_id: number;
              short_name: string;
            }
          | null = null;

        if (resolvedServiceId === undefined && resolvedServiceTypeId === undefined) {
          const availableServicesResponse = await client.fee.getAvailableService({
            shop_id: Number(credentials.shop_id),
            from_district: parseRequiredPositiveInt(
              resolvedFrom.provider_district.external_id,
              "from provider district external_id",
            ),
            to_district: parseRequiredPositiveInt(
              resolvedTo.provider_district.external_id,
              "to provider district external_id",
            ),
          });

          const firstAvailableService = availableServicesResponse.data?.[0];

          if (!firstAvailableService) {
            throw new BadRequestError(
              `No available shipping service was returned by ${provider.display_name} for the selected route`,
            );
          }

          resolvedServiceId = firstAvailableService.service_id;
          resolvedServiceTypeId = firstAvailableService.service_type_id;
          appliedService = {
            service_id: firstAvailableService.service_id,
            service_type_id: firstAvailableService.service_type_id,
            short_name: firstAvailableService.short_name,
          };
        }

        const response = await client.fee.calculateFee({
          from_district_id: parseRequiredPositiveInt(
            resolvedFrom.provider_district.external_id,
            "from provider district external_id",
          ),
          from_ward_code: fromWardCode,
          service_id: resolvedServiceId,
          service_type_id: resolvedServiceTypeId,
          to_district_id: parseRequiredPositiveInt(
            resolvedTo.provider_district.external_id,
            "to provider district external_id",
          ),
          to_ward_code: toWardCode,
          height: parseOptionalNonNegativeInt(input.height, "height"),
          length: parseOptionalNonNegativeInt(input.length, "length"),
          weight: parseOptionalNonNegativeInt(input.weight, "weight"),
          width: parseOptionalNonNegativeInt(input.width, "width"),
          insurance_value: parseOptionalNonNegativeInt(
            input.insurance_value,
            "insurance_value",
          ),
          cod_value: parseOptionalNonNegativeInt(input.cod_value, "cod_value"),
          coupon:
            typeof input.coupon === "string" && input.coupon.trim()
              ? input.coupon.trim()
              : undefined,
          items: Array.isArray(input.items)
            ? input.items.map((item, index) => ({
                name:
                  typeof item.name === "string" && item.name.trim()
                    ? item.name.trim()
                    : `Item ${index + 1}`,
                quantity: parseRequiredPositiveInt(
                  item.quantity ?? 1,
                  `items[${index}].quantity`,
                ),
                height: parseOptionalNonNegativeInt(
                  item.height,
                  `items[${index}].height`,
                ),
                weight: parseOptionalNonNegativeInt(
                  item.weight,
                  `items[${index}].weight`,
                ),
                length: parseOptionalNonNegativeInt(
                  item.length,
                  `items[${index}].length`,
                ),
                width: parseOptionalNonNegativeInt(
                  item.width,
                  `items[${index}].width`,
                ),
              }))
            : undefined,
        });

        return {
          store_id,
          provider_code: provider.code,
          resolved_from: resolvedFrom,
          resolved_to: resolvedTo,
          applied_service: appliedService,
          quote: response.data,
        };
      }
      default:
        throw new BadRequestError(
          `Provider ${provider.display_name} does not support canonical fee calculation yet`,
        );
    }
  },

  connectProvider: async (providerCode: string, storeId: string, input: ShippingConnectInput) => {
    await syncProviderCatalog();

    const provider = await getProviderOrThrow(providerCode);
    const adapter = resolveShippingAdapter(provider.code);
    const credentials = adapter.validateCredentials(ensureCredentialsObject(input.credentials));
    const metadata = ensurePlainObject(input.metadata);
    const shouldVerify = input.verify !== false;
    const verification = shouldVerify
      ? await adapter.verifyConnection({
          credentials,
          metadata,
        })
      : {
          success: true,
          message: "Configuration saved without remote verification.",
          metadata: {
            verification_mode: "skipped",
          },
        };

    const now = new Date();
    const existingConnection = await prisma.shippingConnection.findUnique({
      where: {
        provider_id_store_id: {
          provider_id: provider.id,
          store_id: storeId,
        },
      },
    });

    const nextStatus: ShippingConnectionStatus = verification.success ? "connected" : "error";
    const nextMetadata = {
      ...metadata,
      provider_code: provider.code,
      verify_requested: shouldVerify,
      verification_message: verification.message,
      verification_metadata: verification.metadata ?? {},
    };

    const connection = existingConnection
      ? await prisma.shippingConnection.update({
          where: { id: existingConnection.id },
          data: {
            status: nextStatus,
            credentials_json: toJsonObject(credentials),
            metadata_json: toJsonObject(mergeMetadata(existingConnection.metadata_json, nextMetadata)),
            error_message: verification.success ? null : verification.message,
            last_verified_at: shouldVerify ? now : existingConnection.last_verified_at,
            connected_at: verification.success ? existingConnection.connected_at ?? now : existingConnection.connected_at,
            disconnected_at: verification.success ? null : existingConnection.disconnected_at,
          },
        })
      : await prisma.shippingConnection.create({
          data: {
            provider_id: provider.id,
            store_id: storeId,
            status: nextStatus,
            credentials_json: toJsonObject(credentials),
            metadata_json: toJsonObject(nextMetadata),
            error_message: verification.success ? null : verification.message,
            last_verified_at: shouldVerify ? now : null,
            connected_at: verification.success ? now : null,
            disconnected_at: null,
          },
        });

    await prisma.shippingConnectionHistory.create({
      data: {
        connection_id: connection.id,
        action: existingConnection ? "updated" : "connected",
        status: nextStatus,
        store_id: storeId,
        provider_code: provider.code,
        payload_json: toJsonObject({
          credentials: adapter.maskCredentials(credentials),
          metadata,
          verification,
        }),
        error_message: verification.success ? null : verification.message,
        actor_id: input.actor?.id?.trim() || null,
        actor_name: input.actor?.name?.trim() || null,
      },
    });

    return ShippingService.getConnectionDetail(provider.code, storeId);
  },

  disconnectProvider: async (providerCode: string, storeId: string, input: ShippingDisconnectInput) => {
    await syncProviderCatalog();

    const provider = await getProviderOrThrow(providerCode);
    const existingConnection = await prisma.shippingConnection.findUnique({
      where: {
        provider_id_store_id: {
          provider_id: provider.id,
          store_id: storeId,
        },
      },
    });

    if (!existingConnection) {
      throw new NotFoundError("Shipping connection not found");
    }

    const adapter = resolveShippingAdapter(provider.code);
    const maskedCredentials =
      existingConnection.credentials_json &&
      typeof existingConnection.credentials_json === "object" &&
      !Array.isArray(existingConnection.credentials_json)
        ? adapter.maskCredentials(existingConnection.credentials_json as Record<string, unknown>)
        : {};

    const connection = await prisma.shippingConnection.update({
      where: { id: existingConnection.id },
      data: {
        status: "disconnected",
        credentials_json: Prisma.JsonNull,
        error_message: null,
        disconnected_at: new Date(),
      },
    });

    await prisma.shippingConnectionHistory.create({
      data: {
        connection_id: connection.id,
        action: "disconnected",
        status: "disconnected",
        store_id: storeId,
        provider_code: provider.code,
        payload_json: toJsonObject({
          previous_status: existingConnection.status,
          previous_credentials: maskedCredentials,
        }),
        actor_id: input.actor?.id?.trim() || null,
        actor_name: input.actor?.name?.trim() || null,
      },
    });

    return ShippingService.getConnectionDetail(provider.code, storeId);
  },

  verifyProvider: async (providerCode: string, storeId: string, input: ShippingVerifyInput) => {
    await syncProviderCatalog();

    const provider = await getProviderOrThrow(providerCode);
    const adapter = resolveShippingAdapter(provider.code);
    const existingConnection = await prisma.shippingConnection.findUnique({
      where: {
        provider_id_store_id: {
          provider_id: provider.id,
          store_id: storeId,
        },
      },
    });

    const metadata = ensurePlainObject(input.metadata);
    const credentials = input.credentials
      ? adapter.validateCredentials(ensureCredentialsObject(input.credentials))
      : existingConnection?.credentials_json &&
          typeof existingConnection.credentials_json === "object" &&
          !Array.isArray(existingConnection.credentials_json)
        ? adapter.validateCredentials(existingConnection.credentials_json as Record<string, unknown>)
        : null;

    if (!credentials) {
      throw new BadRequestError("No credentials available to verify");
    }

    const verification = await adapter.verifyConnection({
      credentials,
      metadata,
    });

    if (existingConnection) {
      await prisma.shippingConnection.update({
        where: { id: existingConnection.id },
        data: {
          status: verification.success ? "connected" : "error",
          error_message: verification.success ? null : verification.message,
          last_verified_at: new Date(),
        },
      });

      await prisma.shippingConnectionHistory.create({
        data: {
          connection_id: existingConnection.id,
          action: "verified",
          status: verification.success ? "connected" : "error",
          store_id: storeId,
          provider_code: provider.code,
          payload_json: toJsonObject({
            verification,
            credentials: adapter.maskCredentials(credentials),
          }),
          error_message: verification.success ? null : verification.message,
        },
      });
    }

    return {
      store_id: storeId,
      provider_code: provider.code,
      success: verification.success,
      message: verification.message,
      metadata: verification.metadata ?? {},
      status: buildStatusMeta(verification.success ? "connected" : "error"),
    };
  },

  receiveGHNOrderStatusCallback: async (payload: GHNOrderStatusCallbackPayload) => {
    const trackingCode = toOptionalString(payload.OrderCode);
    const shopId = toOptionalPositiveInt(payload.ShopID);

    if (!trackingCode) {
      console.warn("GHN order status callback missing OrderCode", payload);
      return { matched: false };
    }

    const order = await resolveGHNWebhookOrder(trackingCode, shopId);

    if (!order) {
      console.info(
        `GHN callback did not resolve a unique order for tracking code ${trackingCode}${shopId ? ` and ShopID ${shopId}` : ""}`,
      );
      return { matched: false, tracking_code: trackingCode, shop_id: shopId };
    }

    const nextProcessingStatus = mapGHNStatusToProcessingStatus(payload.Status);
    const nextShippingStatus = toOptionalString(payload.Status) ?? order.processing_status;
    const warehouse = toOptionalString(payload.Warehouse);
    const timestamp = toOptionalString(payload.Time) ?? new Date().toISOString();

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          shipping_service: "GHN",
          shipping_status: nextShippingStatus,
          warehouse_status: warehouse ?? undefined,
          ...(nextProcessingStatus ? { processing_status: nextProcessingStatus } : {}),
        },
      });

      await tx.orderHistory.create({
        data: {
          order_id: order.id,
          event_type: "shipping_webhook_received",
          description: "Nhan callback trang thai don hang tu GHN",
          actor_name: "GHN Webhook",
          metadata: {
            provider: "ghn",
            callback_type: payload.Type ?? null,
            tracking_code: trackingCode,
            shipping_status: nextShippingStatus,
            processing_status: nextProcessingStatus ?? null,
            description: payload.Description ?? null,
            reason: payload.Reason ?? null,
            reason_code: payload.ReasonCode ?? null,
            warehouse: warehouse ?? null,
            callback_time: timestamp,
            payload,
          } as Prisma.InputJsonObject,
        },
      });
    });

    return {
      matched: true,
      order_id: order.id,
      tracking_code: trackingCode,
      shop_id: shopId,
      processing_status: nextProcessingStatus ?? order.processing_status,
    };
  },

  receiveGHNTicketCallback: async (payload: GHNTicketCallbackPayload) => {
    const trackingCode = toOptionalString(payload.OrderCode);

    if (!trackingCode) {
      console.info("GHN ticket callback received without OrderCode", payload);
      return { matched: false };
    }

    const order = await resolveGHNWebhookOrder(trackingCode);

    if (!order) {
      console.info(`GHN ticket callback did not resolve a unique order for tracking code ${trackingCode}`);
      return { matched: false, tracking_code: trackingCode };
    }

    await prisma.orderHistory.create({
      data: {
        order_id: order.id,
        event_type: "shipping_ticket_updated",
        description: "Nhan callback ticket tu GHN",
        actor_name: "GHN Ticket Webhook",
        metadata: {
          provider: "ghn",
          ticket_id: payload.TicketId ?? null,
          tracking_code: trackingCode,
          type: payload.Type ?? null,
          status: payload.Status ?? null,
          status_id: payload.StatusID ?? null,
          customer_name: payload.C_Name ?? null,
          updated_at: payload.UpdatedAt ?? null,
          payload,
        } as Prisma.InputJsonObject,
      },
    });

    return {
      matched: true,
      order_id: order.id,
      tracking_code: trackingCode,
      ticket_id: payload.TicketId ?? null,
    };
  },
};

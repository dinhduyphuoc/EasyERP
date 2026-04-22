import { prisma } from "@lib/prisma";
import { BadRequestError, NotFoundError } from "@/common";
import { Prisma, type ShippingConnectionStatus } from "../../../generated/prisma/client";
import {
  resolveShippingAdapter,
  shippingProviderAdapters,
} from "./shipping.adapters";
import type {
  GHNOrderStatusCallbackPayload,
  GHNTicketCallbackPayload,
  ShippingConnectInput,
  ShippingDisconnectInput,
  ShippingVerifyInput,
} from "./shipping.types";

const DEFAULT_STORE_ID = "default-store";

const STATUS_LABELS: Record<ShippingConnectionStatus, string> = {
  disconnected: "Chưa liên kết",
  connected: "Đã liên kết",
  error: "Lỗi",
};

const normalizeStoreId = (value: unknown) => {
  if (typeof value !== "string") {
    return DEFAULT_STORE_ID;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : DEFAULT_STORE_ID;
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
  listProviders: async (storeIdInput?: string) => {
    await syncProviderCatalog();

    const storeId = normalizeStoreId(storeIdInput);
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

  getConnectionDetail: async (providerCode: string, storeIdInput?: string) => {
    await syncProviderCatalog();

    const storeId = normalizeStoreId(storeIdInput);
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

  connectProvider: async (providerCode: string, input: ShippingConnectInput) => {
    await syncProviderCatalog();

    const provider = await getProviderOrThrow(providerCode);
    const adapter = resolveShippingAdapter(provider.code);
    const storeId = normalizeStoreId(input.store_id);
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

  disconnectProvider: async (providerCode: string, input: ShippingDisconnectInput) => {
    await syncProviderCatalog();

    const provider = await getProviderOrThrow(providerCode);
    const storeId = normalizeStoreId(input.store_id);
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

  verifyProvider: async (providerCode: string, input: ShippingVerifyInput) => {
    await syncProviderCatalog();

    const provider = await getProviderOrThrow(providerCode);
    const adapter = resolveShippingAdapter(provider.code);
    const storeId = normalizeStoreId(input.store_id);
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

    if (!trackingCode) {
      console.warn("GHN order status callback missing OrderCode", payload);
      return { matched: false };
    }

    const order = await prisma.order.findFirst({
      where: { tracking_code: trackingCode },
      select: {
        id: true,
        order_code: true,
        tracking_code: true,
        processing_status: true,
      },
    });

    if (!order) {
      console.info(`GHN callback did not match any order for tracking code ${trackingCode}`);
      return { matched: false, tracking_code: trackingCode };
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
      processing_status: nextProcessingStatus ?? order.processing_status,
    };
  },

  receiveGHNTicketCallback: async (payload: GHNTicketCallbackPayload) => {
    const trackingCode = toOptionalString(payload.OrderCode);

    if (!trackingCode) {
      console.info("GHN ticket callback received without OrderCode", payload);
      return { matched: false };
    }

    const order = await prisma.order.findFirst({
      where: { tracking_code: trackingCode },
      select: { id: true },
    });

    if (!order) {
      console.info(`GHN ticket callback did not match any order for tracking code ${trackingCode}`);
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

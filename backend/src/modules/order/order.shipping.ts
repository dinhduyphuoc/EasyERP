import { prisma } from "@lib/prisma";
import { createGHNClient, type GHNCreateOrderResponse } from "@/lib/ghn";
import { BadRequestError, NotFoundError } from "@/common";
import { resolveProviderLocationFromCanonical } from "@/modules/shipping/shipping.location.service";
import {
  DEFAULT_GHN_HEIGHT,
  DEFAULT_GHN_LENGTH,
  DEFAULT_GHN_PAYMENT_TYPE_ID,
  DEFAULT_GHN_REQUIRED_NOTE,
  DEFAULT_GHN_WEIGHT,
  DEFAULT_GHN_WIDTH,
  toOptionalTrimmedString,
  toProviderRequestError,
} from "./order.helpers";
import type { OrderForMutation } from "./order.persistence";

export const getConnectedGHNCredentials = async (storeId: string) => {
  const provider = await prisma.shippingProvider.findUnique({
    where: { code: "ghn" },
    select: { id: true },
  });

  if (!provider) {
    throw new NotFoundError("GHN provider is not configured");
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
    throw new BadRequestError("GHN connection is not available for this store");
  }

  if (
    !connection.credentials_json ||
    typeof connection.credentials_json !== "object" ||
    Array.isArray(connection.credentials_json)
  ) {
    throw new BadRequestError("GHN credentials are missing");
  }

  const credentials = connection.credentials_json as Record<string, unknown>;
  const token = typeof credentials.token === "string" ? credentials.token.trim() : "";
  const shopId = typeof credentials.shop_id === "string" ? credentials.shop_id.trim() : "";

  if (!token) {
    throw new BadRequestError("GHN token is missing");
  }

  if (!shopId) {
    throw new BadRequestError("GHN shop_id is missing");
  }

  return { token, shopId };
};

const getConnectedGHNProviderContext = async (storeId: string) => {
  const provider = await prisma.shippingProvider.findUnique({
    where: { code: "ghn" },
    select: { id: true, code: true, display_name: true },
  });

  if (!provider) {
    throw new NotFoundError("GHN provider is not configured");
  }

  const { token, shopId } = await getConnectedGHNCredentials(storeId);
  const client = createGHNClient({
    token,
    shopId,
  });

  return {
    provider,
    client,
    shopId,
  };
};

const toRequiredTrimmedString = (value: string | null | undefined, fieldName: string) => {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    throw new BadRequestError(`${fieldName} is required to create a GHN shipment`);
  }

  return trimmed;
};

const resolvePositiveMetric = (
  value: number | null | undefined,
  fallback: number,
) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.round(value);
};

const resolveGHNRequiredNote = (value: string | null | undefined) => {
  const normalized = toOptionalTrimmedString(value)?.toUpperCase();

  if (
    normalized === "CHOTHUHANG" ||
    normalized === "CHOXEMHANGKHONGTHU" ||
    normalized === "KHONGCHOXEMHANG"
  ) {
    return normalized;
  }

  return DEFAULT_GHN_REQUIRED_NOTE;
};

const resolveGHNPaymentTypeId = (order: OrderForMutation) => {
  if (order.cod_amount.gt(0)) {
    return 2;
  }

  return DEFAULT_GHN_PAYMENT_TYPE_ID;
};

const ghnShippingStatusLabels: Record<string, string> = {
  ready_to_pick: "Sẵn sàng lấy hàng",
  picking: "Đang lấy hàng",
  picked: "Đã lấy hàng",
  storing: "Đang luân chuyển",
  transporting: "Đang vận chuyển",
  sorting: "Đang phân loại",
  delivering: "Đang giao hàng",
  money_collect_picking: "Đang thu tiền",
  money_collect_delivering: "Đang đối soát COD",
  delivered: "Đã giao hàng",
  delivery_fail: "Giao hàng thất bại",
  waiting_to_return: "Chờ hoàn hàng",
  return: "Đang hoàn hàng",
  returned: "Đã hoàn hàng",
  return_transporting: "Đang chuyển hoàn",
  return_sorting: "Đang phân loại hoàn",
  cancel: "Đã hủy",
  exception: "Ngoại lệ vận chuyển",
  damage: "Hàng hư hỏng",
  lost: "Thất lạc",
};

export const formatShippingStatusLabel = (value: string | null | undefined) => {
  const normalized = toOptionalTrimmedString(value)?.toLowerCase();

  if (!normalized) {
    return "Không xác định";
  }

  return (
    ghnShippingStatusLabels[normalized] ??
    normalized
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
};

export const toTrackingLogTimestamp = (entry: Record<string, unknown>) => {
  const timestampKeys = [
    "action_at",
    "action_time",
    "updated_at",
    "updated_date",
    "created_at",
    "timestamp",
  ];

  for (const key of timestampKeys) {
    const value = entry[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
};

export const toTrackingLogStatus = (entry: Record<string, unknown>) => {
  const statusKeys = ["status", "status_name", "action_status"];

  for (const key of statusKeys) {
    const value = entry[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
};

export const toTrackingLogLabel = (entry: Record<string, unknown>) => {
  const labelKeys = ["status_name", "description", "message", "action_name", "title", "status"];

  for (const key of labelKeys) {
    const value = entry[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "Tracking update";
};

const buildGHNOrderItems = (order: OrderForMutation) => {
  const fallbackItemWeight = Math.max(
    1,
    Math.round(
      resolvePositiveMetric(order.weight, DEFAULT_GHN_WEIGHT) /
        Math.max(
          order.items.reduce((total, item) => total + Math.max(item.quantity, 0), 0),
          1,
        ),
    ),
  );

  return order.items.map((item) => ({
    name: item.product_name,
    code: item.sku || undefined,
    quantity: Math.max(item.quantity, 1),
    price: Number(item.unit_price),
    length: resolvePositiveMetric(item.item_length, DEFAULT_GHN_LENGTH),
    width: resolvePositiveMetric(item.item_width, DEFAULT_GHN_WIDTH),
    height: resolvePositiveMetric(item.item_height, DEFAULT_GHN_HEIGHT),
    weight: resolvePositiveMetric(item.item_weight, fallbackItemWeight),
    category: item.category_level1
      ? {
          level1: item.category_level1,
        }
      : undefined,
  }));
};

export const createGHNShipmentForOrder = async (
  storeId: string,
  order: OrderForMutation,
  senderOverrides?: {
    fromName?: string | null;
    fromPhone?: string | null;
  },
) => {
  if (toOptionalTrimmedString(order.tracking_code)) {
    return {
      trackingCode: toOptionalTrimmedString(order.tracking_code) as string,
      providerName: "GHN",
      created: false,
    };
  }

  if (!order.from_address_detail || !order.to_address_detail) {
    throw new BadRequestError(
      "Both store and customer shipping addresses are required before creating a GHN shipment",
    );
  }

  if (!order.service_id && !order.service_type_id) {
    throw new BadRequestError(
      "A GHN service must be selected before creating a shipment",
    );
  }

  if (order.items.length === 0) {
    throw new BadRequestError(
      "At least one order item is required before creating a GHN shipment",
    );
  }

  const resolvedToName = toRequiredTrimmedString(order.customer_name, "customer_name");
  const resolvedToPhone = toRequiredTrimmedString(order.customer_phone, "customer_phone");
  const resolvedToAddress = toRequiredTrimmedString(
    order.to_address_detail.address_line ?? order.customer_address,
    "to_address",
  );
  const resolvedFromName = toRequiredTrimmedString(
    toOptionalTrimmedString(senderOverrides?.fromName) ?? order.from_name,
    "from_name",
  );
  const resolvedFromPhone = toRequiredTrimmedString(
    toOptionalTrimmedString(senderOverrides?.fromPhone) ?? order.from_phone,
    "from_phone",
  );
  const resolvedFromAddress = toRequiredTrimmedString(
    order.from_address_detail.address_line ?? order.from_address,
    "from_address",
  );

  const fromCanonicalLocation = {
    address_id: order.from_address_detail.id,
    state_id: order.from_address_detail.state_id,
    city_id: order.from_address_detail.city_id,
    district_id: order.from_address_detail.district_id,
  };
  const toCanonicalLocation = {
    address_id: order.to_address_detail.id,
    state_id: order.to_address_detail.state_id,
    city_id: order.to_address_detail.city_id,
    district_id: order.to_address_detail.district_id,
  };
  const isSameCanonicalLocation =
    fromCanonicalLocation.address_id === toCanonicalLocation.address_id ||
    (
      fromCanonicalLocation.state_id === toCanonicalLocation.state_id &&
      fromCanonicalLocation.city_id === toCanonicalLocation.city_id &&
      fromCanonicalLocation.district_id === toCanonicalLocation.district_id
    );

  const { provider, client, shopId } = await getConnectedGHNProviderContext(storeId);
  const providerContext = {
    client,
    provider,
    store_id: storeId,
  };
  const resolvedFrom = await resolveProviderLocationFromCanonical(
    providerContext,
    fromCanonicalLocation,
    { require_district: true },
  );
  const resolvedTo = isSameCanonicalLocation
    ? resolvedFrom
    : await resolveProviderLocationFromCanonical(
        providerContext,
        toCanonicalLocation,
        { require_district: true },
      );
  const toWardCode =
    resolvedTo.provider_ward?.code?.trim() ??
    resolvedTo.provider_ward?.external_id ??
    null;
  const toDistrictId = Number(resolvedTo.provider_district.external_id);

  if (!toWardCode || !toDistrictId) {
    throw new BadRequestError(
      "Customer shipping location cannot be mapped to GHN ward/district",
    );
  }

  let createResponse: GHNCreateOrderResponse;
  try {
    createResponse = (await client.order.createOrder({
      payment_type_id: resolveGHNPaymentTypeId(order),
      required_note: resolveGHNRequiredNote(order.required_note),
      note: toOptionalTrimmedString(order.order_notes) ?? toOptionalTrimmedString(order.note),
      to_name: resolvedToName,
      to_phone: resolvedToPhone,
      to_address: resolvedToAddress,
      to_ward_code: toWardCode,
      to_district_id: toDistrictId,
      weight: resolvePositiveMetric(order.weight, DEFAULT_GHN_WEIGHT),
      length: resolvePositiveMetric(order.length, DEFAULT_GHN_LENGTH),
      width: resolvePositiveMetric(order.width, DEFAULT_GHN_WIDTH),
      height: resolvePositiveMetric(order.height, DEFAULT_GHN_HEIGHT),
      service_id: order.service_id ?? undefined,
      service_type_id: order.service_type_id ?? undefined,
      items: buildGHNOrderItems(order),
      from_name: resolvedFromName,
      from_phone: resolvedFromPhone,
      from_address: resolvedFromAddress,
      from_ward_name: resolvedFrom.provider_ward?.name ?? undefined,
      from_district_name: resolvedFrom.provider_district.name ?? undefined,
      from_province_name: resolvedFrom.provider_province.name ?? undefined,
      return_phone: toOptionalTrimmedString(order.return_phone) ?? order.from_phone ?? undefined,
      return_address:
        toOptionalTrimmedString(order.return_address) ?? order.from_address_detail.address_line ?? undefined,
      client_order_code: order.order_code,
      cod_amount: order.cod_amount.gt(0) ? Number(order.cod_amount) : undefined,
      content:
        toOptionalTrimmedString(order.content) ??
        order.items.map((item) => item.product_name).slice(0, 3).join(", "),
      pick_station_id: order.pick_station_id ?? undefined,
      deliver_station_id: order.deliver_station_id ?? undefined,
      insurance_value: order.insurance_value.gt(0) ? Number(order.insurance_value) : undefined,
      coupon: toOptionalTrimmedString(order.coupon) ?? undefined,
      pick_shift: order.pick_shift.length > 0 ? order.pick_shift : undefined,
    } as const)) as GHNCreateOrderResponse;
  } catch (error) {
    throw toProviderRequestError(
      error,
      `Không thể tạo vận đơn GHN với district "${toDistrictId}" và ward "${toWardCode}".`,
    );
  }
  const trackingCode =
    toOptionalTrimmedString(createResponse.data?.order_code) ??
    toOptionalTrimmedString((createResponse.data as { OrderCode?: string } | null)?.OrderCode);

  if (!trackingCode) {
    throw new BadRequestError(
      `GHN did not return an order code after creating the shipment for shop ${shopId}`,
    );
  }

  return {
    trackingCode,
    providerName: "GHN",
    created: true,
  };
};

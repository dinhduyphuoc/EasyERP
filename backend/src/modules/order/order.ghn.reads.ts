import { createGHNClient } from "@/lib/ghn";
import { BadRequestError } from "@/common";
import type {
  OrderShippingOrderInfoResponse,
  OrderShippingPrintResponse,
  OrderShippingTrackingLogsResponse,
} from "./order.types";
import { getOrderForMutation } from "./order.persistence";
import {
  formatShippingStatusLabel,
  getConnectedGHNCredentials,
  toTrackingLogLabel,
  toTrackingLogStatus,
  toTrackingLogTimestamp,
} from "./order.shipping";
import { toOptionalTrimmedString } from "./order.helpers";

export const getGHNPrintInfo = async (
  storeId: string,
  id: number,
): Promise<OrderShippingPrintResponse> => {
  const order = await getOrderForMutation(storeId, id);

  if ((order.shipping_service ?? "").trim().toLowerCase() !== "ghn") {
    throw new BadRequestError("Only GHN orders can generate GHN print links");
  }

  const trackingCode = toOptionalTrimmedString(order.tracking_code);

  if (!trackingCode) {
    throw new BadRequestError("Tracking code is required before printing GHN shipping labels");
  }

  const { token, shopId } = await getConnectedGHNCredentials(storeId);
  const ghnClient = createGHNClient({
    token,
    shopId,
  });
  const response = await ghnClient.order.printOrder({
    order_codes: [trackingCode],
  });

  const printToken = response.data?.token;
  const printUrls = response.print_urls;

  if (!printToken || !printUrls) {
    throw new BadRequestError("GHN did not return a printable label token");
  }

  return {
    provider: "ghn",
    order_id: order.id,
    order_code: order.order_code,
    tracking_code: trackingCode,
    token: printToken,
    expires_in_minutes: 30,
    print_urls: printUrls,
  };
};

export const getGHNOrderInfo = async (
  storeId: string,
  id: number,
): Promise<OrderShippingOrderInfoResponse> => {
  const order = await getOrderForMutation(storeId, id);

  if ((order.shipping_service ?? "").trim().toLowerCase() !== "ghn") {
    throw new BadRequestError("Only GHN orders can fetch GHN shipping logs");
  }

  const trackingCode = toOptionalTrimmedString(order.tracking_code);

  if (!trackingCode) {
    throw new BadRequestError("Tracking code is required before loading GHN shipping logs");
  }

  const { token, shopId } = await getConnectedGHNCredentials(storeId);
  const ghnClient = createGHNClient({
    token,
    shopId,
  });
  const response = await ghnClient.order.getOrderInfo({
    order_code: trackingCode,
  });

  const responseData = Array.isArray(response?.data) ? response.data[0] : response?.data;
  const logs = Array.isArray(responseData?.log) ? responseData.log : [];

  return {
    provider: "ghn",
    order_id: order.id,
    order_code: order.order_code,
    tracking_code: trackingCode,
    current_status:
      typeof responseData?.status === "string" ? responseData.status : null,
    leadtime:
      typeof responseData?.leadtime === "string" ? responseData.leadtime : null,
    finish_date:
      typeof responseData?.finish_date === "string" ? responseData.finish_date : null,
    logs: logs
      .map((entry: unknown) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const status =
          "status" in entry && typeof entry.status === "string" ? entry.status : null;
        const updatedAt =
          "updated_date" in entry && typeof entry.updated_date === "string"
            ? entry.updated_date
            : null;

        if (!status) {
          return null;
        }

        return {
          status,
          label: formatShippingStatusLabel(status),
          updated_at: updatedAt,
        };
      })
      .filter(
        (
          entry: {
            status: string;
            label: string;
            updated_at: string | null;
          } | null,
        ): entry is {
          status: string;
          label: string;
          updated_at: string | null;
        } => Boolean(entry),
      )
      .sort((
        a: { status: string; label: string; updated_at: string | null },
        b: { status: string; label: string; updated_at: string | null },
      ) => {
        if (!a.updated_at || !b.updated_at) {
          return 0;
        }

        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }),
  };
};

export const getGHNTrackingLogs = async (
  storeId: string,
  id: number,
): Promise<OrderShippingTrackingLogsResponse> => {
  const order = await getOrderForMutation(storeId, id);

  if ((order.shipping_service ?? "").trim().toLowerCase() !== "ghn") {
    throw new BadRequestError("Only GHN orders can fetch GHN tracking logs");
  }

  const trackingCode = toOptionalTrimmedString(order.tracking_code);

  if (!trackingCode) {
    throw new BadRequestError("Tracking code is required before loading GHN tracking logs");
  }

  const { token, shopId } = await getConnectedGHNCredentials(storeId);
  const ghnClient = createGHNClient({
    token,
    shopId,
  });
  const response = await ghnClient.order.getTrackingLogs({
    order_code: trackingCode,
  });

  const responseData = response?.data;
  const rawLogs = Array.isArray(responseData)
    ? responseData
    : Array.isArray(responseData?.logs)
      ? responseData.logs
      : Array.isArray(responseData?.tracking_logs)
        ? responseData.tracking_logs
        : Array.isArray(responseData?.data)
          ? responseData.data
          : [];

  return {
    provider: "ghn",
    order_id: order.id,
    order_code: order.order_code,
    tracking_code: trackingCode,
    logs: rawLogs
      .map((entry: unknown) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return null;
        }

        const rawEntry = entry as Record<string, unknown>;

        return {
          status: toTrackingLogStatus(rawEntry),
          label: toTrackingLogLabel(rawEntry),
          updated_at: toTrackingLogTimestamp(rawEntry),
          raw: rawEntry,
        };
      })
      .filter(
        (
          entry: {
            status: string | null;
            label: string;
            updated_at: string | null;
            raw: Record<string, unknown>;
          } | null,
        ): entry is {
          status: string | null;
          label: string;
          updated_at: string | null;
          raw: Record<string, unknown>;
        } => Boolean(entry),
      )
      .sort((
        a: {
          status: string | null;
          label: string;
          updated_at: string | null;
          raw: Record<string, unknown>;
        },
        b: {
          status: string | null;
          label: string;
          updated_at: string | null;
          raw: Record<string, unknown>;
        },
      ) => {
        if (!a.updated_at || !b.updated_at) {
          return 0;
        }

        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }),
  };
};

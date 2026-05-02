import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError } from "@/common";
import type { OrderActionName, OrderActionRequestInput } from "./order.types";
import { mapOrder } from "./order.mapper";
import { getOrderForMutation, persistOrderMutation } from "./order.persistence";
import { buildBeforeUpdateEffect } from "./order.action.effects";
import {
  buildAddPaymentPlan,
  buildConfirmFullPaymentPlan,
} from "./order.payment-actions";
import { createGHNShipmentForOrder } from "./order.shipping";
import {
  generateInvoiceCode,
  normalizeShippingServiceName,
  toOptionalTrimmedString,
  updateOrderStageTimeline,
} from "./order.helpers";
import type { OrderActionHistoryEntry } from "./order.actions.shared";

export const runAction = async (
  storeId: string,
  id: number,
  action: OrderActionName,
  input: OrderActionRequestInput,
) => {
  const existingOrder = await getOrderForMutation(storeId, id);
  const actorName = toOptionalTrimmedString(input.actor_name) ?? "System";
  const note = toOptionalTrimmedString(input.note) ?? null;
  const shippingService = normalizeShippingServiceName(
    toOptionalTrimmedString(input.shipping_service) ?? existingOrder.shipping_service,
  );
  const trackingCode =
    toOptionalTrimmedString(input.tracking_code) ?? existingOrder.tracking_code;
  const shippingStatus =
    toOptionalTrimmedString(input.shipping_status) ?? existingOrder.shipping_status;
  const fromName =
    toOptionalTrimmedString(input.from_name) ?? existingOrder.from_name;
  const fromPhone =
    toOptionalTrimmedString(input.from_phone) ?? existingOrder.from_phone;
  const warehouseStatus =
    toOptionalTrimmedString(input.warehouse_status) ?? existingOrder.warehouse_status;
  const invoiceCode =
    toOptionalTrimmedString(input.invoice_code) ??
    existingOrder.invoice_code ??
    generateInvoiceCode(existingOrder.order_code);

  let nextData: Prisma.OrderUpdateInput = {};
  let historyEntry: OrderActionHistoryEntry | undefined;

  if (action === "confirm") {
    if (existingOrder.processing_status !== "draft") {
      throw new BadRequestError("Only draft orders can be moved to new");
    }

    nextData = {
      processing_status: "placed",
      confirmed_by: actorName,
      warehouse_status: warehouseStatus,
      status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "placed", {
        actor: actorName,
        note,
        warehouse_status: warehouseStatus,
      }) as Prisma.InputJsonValue,
    };
    historyEntry = {
      event_type: "status_changed",
      description: "Chuyển đơn sang trạng thái mới",
      actor_name: actorName,
      metadata: {
        processing_status: "placed",
        warehouse_status: warehouseStatus,
        note,
      },
    };
  }

  if (action === "push_to_delivery") {
    if (!["placed", "draft"].includes(existingOrder.processing_status)) {
      throw new BadRequestError("Only draft or new orders can be pushed to delivery");
    }

    const normalizedShippingService = normalizeShippingServiceName(shippingService);
    let resolvedTrackingCode = trackingCode;
    let resolvedShippingProvider = normalizedShippingService;

    if ((normalizedShippingService ?? "").trim().toLowerCase() === "ghn") {
      const shipment = await createGHNShipmentForOrder(storeId, existingOrder, {
        fromName,
        fromPhone,
      });
      resolvedTrackingCode = shipment.trackingCode;
      resolvedShippingProvider = shipment.providerName;
    }

    nextData = {
      processing_status: "delivering",
      confirmed_by: existingOrder.confirmed_by ?? actorName,
      from_name: fromName,
      from_phone: fromPhone,
      warehouse_status: warehouseStatus ?? existingOrder.warehouse_status ?? "ready_to_ship",
      shipping_service: resolvedShippingProvider,
      tracking_code: resolvedTrackingCode,
      shipping_status: shippingStatus ?? "delivering",
      status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "delivering", {
        actor: actorName,
        shipping_service: resolvedShippingProvider,
        tracking_code: resolvedTrackingCode,
        shipping_status: shippingStatus ?? "delivering",
        warehouse_status: warehouseStatus ?? existingOrder.warehouse_status ?? "ready_to_ship",
        note,
      }) as Prisma.InputJsonValue,
    };
    historyEntry = {
      event_type: "shipping_updated",
      description: "Đẩy đơn sang đơn vị vận chuyển",
      actor_name: actorName,
      metadata: {
        processing_status: "delivering",
        shipping_service: resolvedShippingProvider,
        tracking_code: resolvedTrackingCode,
        shipping_status: shippingStatus ?? "delivering",
        note,
      },
    };
  }

  if (action === "mark_delivered") {
    if (existingOrder.processing_status !== "delivering") {
      throw new BadRequestError("Only delivering orders can be marked as delivered");
    }

    nextData = {
      processing_status: "delivered",
      shipping_status: shippingStatus ?? "delivered",
      status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "delivered", {
        actor: actorName,
        shipping_status: shippingStatus ?? "delivered",
        tracking_code: existingOrder.tracking_code,
        note,
      }) as Prisma.InputJsonValue,
    };
    historyEntry = {
      event_type: "status_changed",
      description: "Xác nhận đã giao hàng",
      actor_name: actorName,
      metadata: {
        processing_status: "delivered",
        shipping_status: shippingStatus ?? "delivered",
        note,
      },
    };
  }

  if (action === "add_payment") {
    const plan = buildAddPaymentPlan({
      existingOrder,
      actorName,
      note,
      input,
    });
    nextData = plan.nextData;
    historyEntry = plan.historyEntry;
  }

  if (action === "confirm_full_payment" || action === "mark_paid") {
    const result = await buildConfirmFullPaymentPlan({
      storeId,
      id,
      existingOrder,
      actorName,
      input,
    });

    if (result.immediateResult) {
      return result.immediateResult;
    }

    if (result.plan) {
      nextData = result.plan.nextData;
      historyEntry = result.plan.historyEntry;
    }
  }

  if (action === "request_invoice") {
    nextData = {
      invoice_code: invoiceCode,
      status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "completed", {
        actor: actorName,
        invoice_code: invoiceCode,
      }) as Prisma.InputJsonValue,
    };
    historyEntry = {
      event_type: "invoice_requested",
      description: "Yêu cầu xuất hóa đơn điện tử",
      actor_name: actorName,
      metadata: {
        invoice_code: invoiceCode,
        note,
      },
    };
  }

  if (action === "complete") {
    if (existingOrder.payment_status !== "paid") {
      throw new BadRequestError("Đơn hàng chưa được thanh toán đủ");
    }

    if (existingOrder.processing_status !== "delivered") {
      throw new BadRequestError("Đơn hàng chưa được giao");
    }

    nextData = {
      processing_status: "completed",
      shipping_status: shippingStatus ?? "delivered",
      invoice_code: existingOrder.invoice_code ?? invoiceCode,
      status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "completed", {
        actor: actorName,
        shipping_status: shippingStatus ?? "delivered",
        invoice_code: existingOrder.invoice_code ?? invoiceCode,
        paid_amount: existingOrder.total_amount.toString(),
        outstanding_amount: existingOrder.outstanding_amount.toString(),
        note,
      }) as Prisma.InputJsonValue,
    };
    historyEntry = {
      event_type: "status_changed",
      description: "Hoàn thành đơn hàng",
      actor_name: actorName,
      metadata: {
        processing_status: "completed",
        shipping_status: shippingStatus ?? "delivered",
        invoice_code: existingOrder.invoice_code ?? invoiceCode,
        note,
      },
    };
  }

  if (action === "cancel") {
    if (!["draft", "placed", "delivering"].includes(existingOrder.processing_status)) {
      throw new BadRequestError("Chỉ có thể hủy đơn hàng ở trạng thái 'Nháp', 'Mới' hoặc 'Đang giao'");
    }

    if (existingOrder.payment_status === "paid") {
      throw new BadRequestError("Không thể hủy. Đơn hàng đã được thanh toán đủ");
    }

    nextData = {
      processing_status: "cancelled",
      shipping_status: existingOrder.shipping_status ?? "cancelled",
      status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "cancelled", {
        actor: actorName,
        shipping_status: "cancelled",
        note: note ?? "Order cancelled",
      }) as Prisma.InputJsonValue,
    };
    historyEntry = {
      event_type: "order_cancelled",
      description: "Hủy đơn hàng",
      actor_name: actorName,
      metadata: {
        processing_status: "cancelled",
        payment_status: existingOrder.payment_status,
        note,
      },
    };
  }

  if (action === "return_order") {
    if (existingOrder.processing_status !== "completed") {
      throw new BadRequestError("Chỉ có thể trả hàng cho đơn hàng đã hoàn thành");
    }

    nextData = {
      processing_status: "returned",
      shipping_status: "returned",
      status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "returned", {
        actor: actorName,
        shipping_status: "returned",
        note: note ?? "Order returned",
      }) as Prisma.InputJsonValue,
    };
    historyEntry = {
      event_type: "order_returned",
      description: "Ghi nhan tra hang",
      actor_name: actorName,
      metadata: {
        processing_status: "returned",
        payment_status: existingOrder.payment_status,
        note,
      },
    };
  }

  if (!historyEntry) {
    throw new BadRequestError(`Unsupported action: ${action}`);
  }

  const updatedOrder = await persistOrderMutation({
    orderId: id,
    data: nextData,
    historyEntry,
    beforeUpdate: buildBeforeUpdateEffect({
      action,
      nextData,
      existingOrder,
      actorName,
      note,
    }),
  });

  return mapOrder(updatedOrder);
};

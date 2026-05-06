import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, NotFoundError } from "@/common";
import { mapOrder } from "./order.mapper";
import { orderInclude } from "./order.persistence";
import type { OrderActionRequestInput } from "./order.types";
import type { MutableOrder, OrderActionPlan } from "./order.actions.shared";
import { OrderRepository } from "./order.repository";
import {
  parseDecimal,
  parsePaymentCollectionMethod,
  toOptionalTrimmedString,
  updateOrderStageTimeline,
} from "./order.helpers";

export const buildAddPaymentPlan = ({
  existingOrder,
  actorName,
  note,
  input,
}: {
  existingOrder: MutableOrder;
  actorName: string;
  note: string | null;
  input: OrderActionRequestInput;
}): OrderActionPlan => {
  if (["cancelled", "returned"].includes(existingOrder.processing_status)) {
    throw new BadRequestError("Cannot add payment to cancelled or returned orders");
  }

  if (existingOrder.outstanding_amount.lte(0)) {
    throw new BadRequestError("Order does not have any remaining balance");
  }

  const paymentAmount = parseDecimal(input.payment_amount, "payment_amount", 0);
  const paymentMethod = parsePaymentCollectionMethod(input.payment_method);

  if (paymentAmount.lte(0)) {
    throw new BadRequestError("payment_amount must be greater than 0");
  }

  if (paymentAmount.gt(existingOrder.outstanding_amount)) {
    throw new BadRequestError("payment_amount cannot exceed outstanding_amount");
  }

  const nextPaidAmount = existingOrder.paid_amount.plus(paymentAmount);
  const nextOutstandingAmount = existingOrder.total_amount.minus(nextPaidAmount);
  const nextPaymentStatus = nextOutstandingAmount.lte(0)
    ? "paid"
    : nextPaidAmount.gt(0)
      ? "deposit"
      : "unpaid";
  const paymentLabel =
    existingOrder.paid_amount.lte(0) && nextOutstandingAmount.gt(0)
      ? "Đặt cọc"
      : nextOutstandingAmount.lte(0)
        ? "Thanh toán đủ"
        : "Thanh toán thêm";

  return {
    nextData: {
      payment_status: nextPaymentStatus,
      deposit_amount: nextPaymentStatus === "deposit" ? nextPaidAmount : existingOrder.deposit_amount,
      paid_amount: nextPaidAmount,
      outstanding_amount: nextOutstandingAmount,
      ...(nextPaymentStatus === "paid" && existingOrder.processing_status === "delivered"
        ? {
            processing_status: "completed" as const,
            status_timeline: updateOrderStageTimeline(
              updateOrderStageTimeline(existingOrder.status_timeline, "payment", {
                actor: actorName,
                paid_amount: nextPaidAmount.toString(),
                outstanding_amount: nextOutstandingAmount.toString(),
                payment_status: nextPaymentStatus,
              }) as Prisma.JsonValue,
              "completed",
              {
                actor: actorName,
                paid_amount: nextPaidAmount.toString(),
                outstanding_amount: nextOutstandingAmount.toString(),
                note: "Order auto-completed after full payment",
              },
            ) as Prisma.InputJsonValue,
          }
        : {
            status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "payment", {
              actor: actorName,
              paid_amount: nextPaidAmount.toString(),
              outstanding_amount: nextOutstandingAmount.toString(),
              payment_status: nextPaymentStatus,
            }) as Prisma.InputJsonValue,
          }),
    },
    historyEntry: {
      event_type: "payment_updated",
      description: paymentLabel,
      actor_name: actorName,
      metadata: {
        payment_amount: paymentAmount.toString(),
        paid_amount: nextPaidAmount.toString(),
        outstanding_amount: nextOutstandingAmount.toString(),
        payment_status: nextPaymentStatus,
        processing_status:
          nextPaymentStatus === "paid" && existingOrder.processing_status === "delivered"
            ? "completed"
            : existingOrder.processing_status,
        payment_method: paymentMethod,
        payment_label: paymentLabel,
        note,
      },
    },
  };
};

export const buildConfirmFullPaymentPlan = async ({
  storeId,
  id,
  existingOrder,
  actorName,
  input,
}: {
  storeId: string;
  id: number;
  existingOrder: MutableOrder;
  actorName: string;
  input: OrderActionRequestInput;
}): Promise<{ immediateResult?: ReturnType<typeof mapOrder>; plan?: OrderActionPlan }> => {
  if (existingOrder.payment_status === "paid" && existingOrder.outstanding_amount.lte(0)) {
    const currentOrder = await OrderRepository.findOrderFirst({
      where: { id, store_id: storeId },
      include: orderInclude,
    });

    if (!currentOrder) {
      throw new NotFoundError("Order not found");
    }

    return { immediateResult: mapOrder(currentOrder) };
  }

  if (existingOrder.outstanding_amount.lte(0)) {
    throw new BadRequestError("Order does not have any remaining balance");
  }

  const paymentMethod = parsePaymentCollectionMethod(input.payment_method);
  const confirmationNote = toOptionalTrimmedString(input.note);

  if (!confirmationNote) {
    throw new BadRequestError("note is required when confirming full payment manually");
  }

  const paymentAmount = existingOrder.outstanding_amount;

  return {
    plan: {
      nextData: {
        payment_status: "paid",
        deposit_amount: existingOrder.deposit_amount,
        paid_amount: existingOrder.total_amount,
        outstanding_amount: new Prisma.Decimal(0),
        ...(existingOrder.processing_status === "delivered"
          ? {
              processing_status: "completed" as const,
              status_timeline: updateOrderStageTimeline(
                updateOrderStageTimeline(existingOrder.status_timeline, "payment", {
                  actor: actorName,
                  paid_amount: existingOrder.total_amount.toString(),
                  outstanding_amount: "0",
                  payment_status: "paid",
                }) as Prisma.JsonValue,
                "completed",
                {
                  actor: actorName,
                  paid_amount: existingOrder.total_amount.toString(),
                  outstanding_amount: "0",
                  note: "Order auto-completed after confirming full payment",
                },
              ) as Prisma.InputJsonValue,
            }
          : {
              status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "payment", {
                actor: actorName,
                paid_amount: existingOrder.total_amount.toString(),
                outstanding_amount: "0",
                payment_status: "paid",
              }) as Prisma.InputJsonValue,
            }),
      },
      historyEntry: {
        event_type: "payment_updated",
        description: "Xác nhận đã thu đủ tiền",
        actor_name: actorName,
        metadata: {
          payment_amount: paymentAmount.toString(),
          payment_status: "paid",
          processing_status:
            existingOrder.processing_status === "delivered" ? "completed" : existingOrder.processing_status,
          paid_amount: existingOrder.total_amount.toString(),
          outstanding_amount: "0",
          payment_method: paymentMethod,
          payment_label: "Xác nhận đã thu đủ tiền",
          note: confirmationNote,
        },
      },
    },
  };
};

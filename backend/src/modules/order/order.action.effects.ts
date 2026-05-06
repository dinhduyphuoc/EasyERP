import { InventoryOrderOrchestration } from "@/modules/inventory/inventory.service";
import { Prisma } from "../../../generated/prisma/client";
import type { OrderActionName } from "./order.types";
import type { MutableOrder } from "./order.actions.shared";

export const buildBeforeUpdateEffect = ({
  action,
  nextData,
  existingOrder,
  actorName,
  note,
}: {
  action: OrderActionName;
  nextData: Prisma.OrderUpdateInput;
  existingOrder: MutableOrder;
  actorName: string;
  note: string | null;
}) => {
  if (action === "push_to_delivery") {
    return async (tx: Prisma.TransactionClient) => {
      await InventoryOrderOrchestration.reserveForOrder({
        tx,
        items: existingOrder.items,
        actorName,
        referenceId: String(existingOrder.id),
        referenceCode: existingOrder.order_code,
        note: note ?? "Order pushed to delivery and inventory reserved",
        mutation: "reserve",
      });
      await InventoryOrderOrchestration.moveOrderToPacking({
        tx,
        items: existingOrder.items,
        actorName,
        referenceId: String(existingOrder.id),
        referenceCode: existingOrder.order_code,
        note: note ?? "Inventory moved to packing before delivery",
        mutation: "move_to_packing",
      });
    };
  }

  if (action === "complete") {
    return async (tx: Prisma.TransactionClient) => {
      await InventoryOrderOrchestration.fulfillOrder({
        tx,
        items: existingOrder.items,
        actorName,
        referenceId: String(existingOrder.id),
        referenceCode: existingOrder.order_code,
        note: note ?? "Order fulfilled",
        mutation: "fulfill",
      });
    };
  }

  if (
    action === "add_payment" &&
    nextData.processing_status === "completed" &&
    existingOrder.processing_status === "delivered"
  ) {
    return async (tx: Prisma.TransactionClient) => {
      await InventoryOrderOrchestration.fulfillOrder({
        tx,
        items: existingOrder.items,
        actorName,
        referenceId: String(existingOrder.id),
        referenceCode: existingOrder.order_code,
        note: note ?? "Order auto-completed after full payment",
        mutation: "fulfill",
      });
    };
  }

  if (
    (action === "confirm_full_payment" || action === "mark_paid") &&
    nextData.processing_status === "completed" &&
    existingOrder.processing_status === "delivered"
  ) {
    return async (tx: Prisma.TransactionClient) => {
      await InventoryOrderOrchestration.fulfillOrder({
        tx,
        items: existingOrder.items,
        actorName,
        referenceId: String(existingOrder.id),
        referenceCode: existingOrder.order_code,
        note: note ?? "Order auto-completed after confirming full payment",
        mutation: "fulfill",
      });
    };
  }

  if (action === "cancel") {
    return async (tx: Prisma.TransactionClient) => {
      if (existingOrder.processing_status === "delivering") {
        await InventoryOrderOrchestration.cancelPackingForOrder({
          tx,
          items: existingOrder.items,
          actorName,
          referenceId: String(existingOrder.id),
          referenceCode: existingOrder.order_code,
          note: note ?? "Cancel packing before releasing inventory",
          mutation: "reserve",
        });
        await InventoryOrderOrchestration.releaseForOrder({
          tx,
          items: existingOrder.items,
          actorName,
          referenceId: String(existingOrder.id),
          referenceCode: existingOrder.order_code,
          note: note ?? "Order cancelled and inventory released",
          mutation: "reserve",
        });
      }
    };
  }

  if (action === "return_order") {
    return async (tx: Prisma.TransactionClient) => {
      await InventoryOrderOrchestration.restockReturnedOrder({
        tx,
        items: existingOrder.items,
        actorName,
        referenceId: String(existingOrder.id),
        referenceCode: existingOrder.order_code,
        note: note ?? "Returned order restocked to inventory",
        mutation: "reserve",
      });
    };
  }

  return undefined;
};

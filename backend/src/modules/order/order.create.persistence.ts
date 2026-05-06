import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError } from "@/common";
import { InventoryOrderOrchestration } from "@/modules/inventory/inventory.service";
import {
  generateNextOrderCode,
  isDuplicateGeneratedOrderCodeError,
  orderInclude,
  resolveOrderAddressId,
} from "./order.persistence";
import type { AddressRequestInput } from "./order.types";
import { OrderRepository } from "./order.repository";

export const persistCreatedOrder = async ({
  storeId,
  orderCode,
  requestedFromAddressId,
  requestedToAddressId,
  requestedReturnAddressId,
  fromAddressDetail,
  toAddressDetail,
  returnAddressDetail,
  orderData,
  normalizedItems,
  historyEntries,
  createdBy,
}: {
  storeId: string;
  orderCode: string | undefined;
  requestedFromAddressId: number | null;
  requestedToAddressId: number | null;
  requestedReturnAddressId: number | null;
  fromAddressDetail: AddressRequestInput | null | undefined;
  toAddressDetail: AddressRequestInput | null | undefined;
  returnAddressDetail: AddressRequestInput | null | undefined;
  orderData: Omit<
    Prisma.OrderUncheckedCreateInput,
    | "store_id"
    | "order_code"
    | "from_address_id"
    | "to_address_id"
    | "return_address_id"
  >;
  normalizedItems: Prisma.OrderItemCreateWithoutOrderInput[];
  historyEntries: Prisma.OrderHistoryCreateWithoutOrderInput[];
  createdBy: string;
}) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const createdOrder = await OrderRepository.withTransaction(async (tx) => {
        const resolvedOrderCode = orderCode ?? (await generateNextOrderCode(tx, storeId));

        const existingOrder = await OrderRepository.findOrderCodeConflictTx(
          tx,
          storeId,
          resolvedOrderCode,
        );

        if (existingOrder) {
          throw new BadRequestError(`Order code "${resolvedOrderCode}" already exists`);
        }

        const [fromAddressId, toAddressId, returnAddressId] = await Promise.all([
          resolveOrderAddressId(tx, requestedFromAddressId, fromAddressDetail, "from_address"),
          resolveOrderAddressId(tx, requestedToAddressId, toAddressDetail, "to_address"),
          resolveOrderAddressId(tx, requestedReturnAddressId, returnAddressDetail, "return_address"),
        ]);

        const order = await OrderRepository.createOrderTx(tx, {
          data: {
            ...orderData,
            store_id: storeId,
            order_code: resolvedOrderCode,
            from_address_id: fromAddressId,
            to_address_id: toAddressId,
            return_address_id: returnAddressId,
            items: {
              create: normalizedItems,
            },
            history: {
              create: historyEntries,
            },
          },
          include: orderInclude,
        });

        if (
          order.processing_status === "delivering" ||
          order.processing_status === "delivered" ||
          order.processing_status === "completed"
        ) {
          await InventoryOrderOrchestration.reserveForOrder({
            tx,
            items: order.items,
            actorName: createdBy,
            referenceId: String(order.id),
            referenceCode: order.order_code,
            note: "Order inventory reserved on create",
            mutation: "reserve",
          });
          await InventoryOrderOrchestration.moveOrderToPacking({
            tx,
            items: order.items,
            actorName: createdBy,
            referenceId: String(order.id),
            referenceCode: order.order_code,
            note: "Order moved to packing on create",
            mutation: "move_to_packing",
          });
        }

        if (order.processing_status === "completed") {
          await InventoryOrderOrchestration.fulfillOrder({
            tx,
            items: order.items,
            actorName: createdBy,
            referenceId: String(order.id),
            referenceCode: order.order_code,
            note: "Order fulfilled on create",
            mutation: "fulfill",
          });
        }

        return order;
      });

      return createdOrder;
    } catch (error) {
      if (orderCode || !isDuplicateGeneratedOrderCodeError(error)) {
        throw error;
      }
    }
  }

  throw new BadRequestError("Unable to generate a unique order code");
};

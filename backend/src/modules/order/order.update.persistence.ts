import { Prisma } from "../../../generated/prisma/client";
import {
  type OrderForMutation,
  type OrderWithRelations,
  orderInclude,
  resolveOrderAddressId,
} from "./order.persistence";
import type { AddressRequestInput } from "./order.types";
import { OrderRepository } from "./order.repository";

type NormalizedOrderItem = {
  product_id: number | null;
  variant_sku: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: Prisma.Decimal;
  discount_amount: Prisma.Decimal;
  sub_total: Prisma.Decimal;
  notes: string | null;
  item_weight: number | null;
  item_length: number | null;
  item_width: number | null;
  item_height: number | null;
  category_level1: string | null;
};

const areOrderItemsEquivalent = (
  existingItems: OrderForMutation["items"],
  normalizedItems: NormalizedOrderItem[],
) => {
  if (existingItems.length !== normalizedItems.length) {
    return false;
  }

  return existingItems.every((item, index) => {
    const nextItem = normalizedItems[index];

    if (!nextItem) {
      return false;
    }

    return (
      item.product_id === (nextItem.product_id ?? null) &&
      item.variant_sku === (nextItem.variant_sku ?? null) &&
      item.product_name === nextItem.product_name &&
      item.sku === nextItem.sku &&
      item.quantity === nextItem.quantity &&
      item.unit_price.equals(nextItem.unit_price) &&
      item.discount_amount.equals(nextItem.discount_amount) &&
      item.sub_total.equals(nextItem.sub_total) &&
      item.notes === (nextItem.notes ?? null) &&
      item.item_weight === (nextItem.item_weight ?? null) &&
      item.item_length === (nextItem.item_length ?? null) &&
      item.item_width === (nextItem.item_width ?? null) &&
      item.item_height === (nextItem.item_height ?? null) &&
      item.category_level1 === (nextItem.category_level1 ?? null)
    );
  });
};

export const persistUpdatedOrder = async ({
  id,
  existingItems,
  requestedFromAddressId,
  requestedToAddressId,
  requestedReturnAddressId,
  fromAddressDetail,
  toAddressDetail,
  returnAddressDetail,
  createHistoryData,
  createVatHistoryData,
  updateData,
  normalizedItems,
}: {
  id: number;
  existingItems: OrderForMutation["items"];
  requestedFromAddressId: number | null;
  requestedToAddressId: number | null;
  requestedReturnAddressId: number | null;
  fromAddressDetail: AddressRequestInput | null | undefined;
  toAddressDetail: AddressRequestInput | null | undefined;
  returnAddressDetail: AddressRequestInput | null | undefined;
  createHistoryData: Prisma.OrderHistoryCreateInput;
  createVatHistoryData?: Prisma.OrderHistoryCreateInput;
  updateData: Omit<
    Prisma.OrderUncheckedUpdateInput,
    "from_address_id" | "to_address_id" | "return_address_id"
  >;
  normalizedItems: NormalizedOrderItem[];
}): Promise<OrderWithRelations> => {
  return OrderRepository.withTransaction(async (tx) => {
    const [fromAddressId, toAddressId, returnAddressId] = await Promise.all([
      resolveOrderAddressId(tx, requestedFromAddressId, fromAddressDetail, "from_address"),
      resolveOrderAddressId(tx, requestedToAddressId, toAddressDetail, "to_address"),
      resolveOrderAddressId(tx, requestedReturnAddressId, returnAddressDetail, "return_address"),
    ]);

    const shouldReplaceItems = !areOrderItemsEquivalent(existingItems, normalizedItems);

    if (shouldReplaceItems) {
      await OrderRepository.deleteOrderItemsByOrderIdTx(tx, id);
    }

    await OrderRepository.createOrderHistoryTx(tx, { data: createHistoryData });

    if (createVatHistoryData) {
      await OrderRepository.createOrderHistoryTx(tx, { data: createVatHistoryData });
    }

    return OrderRepository.updateOrderTx(tx, {
      where: { id },
      data: {
        ...updateData,
        from_address_id: fromAddressId,
        to_address_id: toAddressId,
        return_address_id: returnAddressId,
        ...(shouldReplaceItems
          ? {
              items: {
                create: normalizedItems,
              },
            }
          : {}),
      } as Prisma.OrderUncheckedUpdateInput,
      include: orderInclude,
    });
  });
};

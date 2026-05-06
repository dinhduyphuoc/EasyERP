import { prisma } from "@lib/prisma";
import { Prisma } from "../../../generated/prisma/client";

export type OrderTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const OrderRepository = {
  withTransaction: <T>(
    fn: (tx: OrderTransaction) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ) => prisma.$transaction(fn, options),

  findOrderFirst: <T extends Prisma.OrderFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderFindFirstArgs>,
  ) => prisma.order.findFirst(args),
  findOrderUnique: <T extends Prisma.OrderFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderFindUniqueArgs>,
  ) => prisma.order.findUnique(args),
  findOrders: <T extends Prisma.OrderFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderFindManyArgs>,
  ) => prisma.order.findMany(args),
  countOrders: <T extends Prisma.OrderCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderCountArgs>,
  ) => prisma.order.count(args),
  aggregateOrders: <T extends Prisma.OrderAggregateArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderAggregateArgs>,
  ) => prisma.order.aggregate(args),

  findShippingConnections: <T extends Prisma.ShippingConnectionFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ShippingConnectionFindManyArgs>,
  ) =>
    prisma.shippingConnection.findMany(args),
  findShippingProviderUnique: <T extends Prisma.ShippingProviderFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ShippingProviderFindUniqueArgs>,
  ) =>
    prisma.shippingProvider.findUnique(args),

  findCustomers: <T extends Prisma.CustomerFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.CustomerFindManyArgs>,
  ) => prisma.customer.findMany(args),
  findCustomerFirst: <T extends Prisma.CustomerFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.CustomerFindFirstArgs>,
  ) => prisma.customer.findFirst(args),

  findProductVariants: <T extends Prisma.ProductVariantFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProductVariantFindManyArgs>,
  ) =>
    prisma.productVariant.findMany(args),
  findProducts: <T extends Prisma.ProductFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProductFindManyArgs>,
  ) => prisma.product.findMany(args),

  aggregateOrderItems: <T extends Prisma.OrderItemAggregateArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderItemAggregateArgs>,
  ) =>
    prisma.orderItem.aggregate(args),
  findOrderItems: <T extends Prisma.OrderItemFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderItemFindManyArgs>,
  ) => prisma.orderItem.findMany(args),

  findOrderHistory: <T extends Prisma.OrderHistoryFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderHistoryFindManyArgs>,
  ) => prisma.orderHistory.findMany(args),

  findAddressByIdTx: (tx: OrderTransaction, id: number) =>
    tx.address.findUnique({
      where: { id },
      select: { id: true },
    }),

  findStateByIdTx: (tx: OrderTransaction, id: number) =>
    tx.state.findUnique({
      where: { id },
      select: { id: true, name: true },
    }),

  findCityByIdTx: (tx: OrderTransaction, id: number) =>
    tx.city.findUnique({
      where: { id },
      select: { id: true, state_id: true, name: true },
    }),

  findDistrictByIdTx: (tx: OrderTransaction, id: number) =>
    tx.district.findUnique({
      where: { id },
      select: { id: true, city_id: true, name: true },
    }),

  createAddressTx: (tx: OrderTransaction, data: Prisma.AddressUncheckedCreateInput) =>
    tx.address.create({
      data,
      select: { id: true },
    }),

  createOrderHistoryTx: <T extends Prisma.OrderHistoryCreateArgs>(
    tx: OrderTransaction,
    args: Prisma.SelectSubset<T, Prisma.OrderHistoryCreateArgs>,
  ) => tx.orderHistory.create(args),

  findOrderCodeConflictTx: (tx: OrderTransaction, storeId: string, orderCode: string) =>
    tx.order.findFirst({
      where: { order_code: orderCode, store_id: storeId },
      select: { id: true },
    }),

  createOrderTx: <T extends Prisma.OrderCreateArgs>(
    tx: OrderTransaction,
    args: Prisma.SelectSubset<T, Prisma.OrderCreateArgs>,
  ) => tx.order.create(args),
  updateOrderTx: <T extends Prisma.OrderUpdateArgs>(
    tx: OrderTransaction,
    args: Prisma.SelectSubset<T, Prisma.OrderUpdateArgs>,
  ) => tx.order.update(args),
  deleteOrderItemsByOrderIdTx: (tx: OrderTransaction, orderId: number) =>
    tx.orderItem.deleteMany({
      where: { order_id: orderId },
    }),

  upsertOrderCodeCounterTx: (tx: OrderTransaction, storeId: string) =>
    tx.orderCodeCounter.upsert({
      where: { store_id: storeId },
      create: {
        store_id: storeId,
        last_sequence: 1,
      },
      update: {
        last_sequence: {
          increment: 1,
        },
      },
      select: {
        last_sequence: true,
      },
    }),
};

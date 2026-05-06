import { prisma } from "@lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import type { CustomerStatusInput } from "./customer.types";

export type CustomerTransaction = Prisma.TransactionClient;

export const CUSTOMER_INCLUDE = {
  customer_category: true,
  orders: {
    select: { order_date: true },
    orderBy: { order_date: "desc" as const },
    take: 1,
  },
  addresses: {
    include: { address: true },
    orderBy: [{ is_default: "desc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.CustomerInclude;

export type CustomerRecord = Prisma.CustomerGetPayload<{
  include: typeof CUSTOMER_INCLUDE;
}>;

export const CustomerRepository = {
  withTransaction: <T>(fn: (tx: CustomerTransaction) => Promise<T>) =>
    prisma.$transaction(fn),

  generateNextCustomerCode: async (tx: CustomerTransaction, prefix: string, numberLength: number) => {
    const codeRegex = `${prefix}([0-9]+)$`;
    const matchingPattern = `^${prefix}[0-9]+$`;
    const rows = await tx.$queryRaw<Array<{ max_sequence: number | null }>>(Prisma.sql`
      SELECT MAX(SUBSTRING(client_code FROM ${codeRegex})::integer) AS max_sequence
      FROM "Customer"
      WHERE client_code ~ ${matchingPattern}
    `);
    const nextSequence = (rows[0]?.max_sequence ?? 0) + 1;

    return `${prefix}${String(nextSequence).padStart(numberLength, "0")}`;
  },

  findAddressById: (tx: CustomerTransaction, addressId: number) =>
    tx.address.findUnique({
      where: { id: addressId },
      select: { id: true },
    }),

  findLocationRefs: (
    tx: CustomerTransaction,
    stateId: number,
    cityId: number,
    districtId: number | null,
  ) =>
    Promise.all([
      tx.state.findUnique({ where: { id: stateId }, select: { id: true, name: true } }),
      tx.city.findUnique({ where: { id: cityId }, select: { id: true, state_id: true, name: true } }),
      districtId
        ? tx.district.findUnique({
            where: { id: districtId },
            select: { id: true, city_id: true, name: true },
          })
        : Promise.resolve(null),
    ]),

  createAddress: (
    tx: CustomerTransaction,
    data: Prisma.AddressUncheckedCreateInput,
  ) =>
    tx.address.create({
      data,
      select: { id: true },
    }),

  createCustomerAddress: (
    tx: CustomerTransaction,
    data: Prisma.CustomerAddressUncheckedCreateInput,
  ) =>
    tx.customerAddress.create({
      data,
    }),

  findCustomerByIdWithRelations: (storeId: string, id: number) =>
    prisma.customer.findFirst({
      where: { id, store_id: storeId },
      include: CUSTOMER_INCLUDE,
    }),

  findCustomerCodeConflict: (
    tx: CustomerTransaction,
    storeId: string,
    clientCode: string,
    excludeId?: number,
  ) =>
    tx.customer.findFirst({
      where: {
        client_code: clientCode,
        store_id: storeId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    }),

  findLiveCustomerByPhone: (
    tx: CustomerTransaction,
    storeId: string,
    phone: string,
    liveStatuses: CustomerStatusInput[],
    excludeId?: number,
  ) =>
    tx.customer.findFirst({
      where: {
        store_id: storeId,
        phone,
        status: { in: liveStatuses },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, client_code: true },
    }),

  findCustomerCategoryById: (tx: CustomerTransaction, storeId: string, customerCategoryId: number) =>
    tx.customerCategory.findFirst({
      where: { id: customerCategoryId, store_id: storeId },
      select: { id: true },
    }),

  createCustomer: (
    tx: CustomerTransaction,
    data: Prisma.CustomerUncheckedCreateInput,
  ) =>
    tx.customer.create({
      data,
      include: CUSTOMER_INCLUDE,
    }),

  findCustomerByIdWithRelationsOrThrowInTx: (
    tx: CustomerTransaction,
    storeId: string,
    customerId: number,
  ) =>
    tx.customer.findFirstOrThrow({
      where: { id: customerId, store_id: storeId },
      include: CUSTOMER_INCLUDE,
    }),

  findCustomers: (args: {
    storeId: string;
    status?: CustomerStatusInput;
    excludedStatuses?: CustomerStatusInput[];
    customerCategoryId?: number;
    search?: string;
  }) => {
    const where: Prisma.CustomerWhereInput = {
      store_id: args.storeId,
      ...(args.status ? { status: args.status } : {}),
      ...(!args.status && args.excludedStatuses ? { status: { notIn: args.excludedStatuses } } : {}),
      ...(args.customerCategoryId ? { customer_category_id: args.customerCategoryId } : {}),
      ...(args.search
        ? {
            OR: [
              { client_code: { contains: args.search, mode: "insensitive" } },
              { full_name: { contains: args.search, mode: "insensitive" } },
              { phone: { contains: args.search, mode: "insensitive" } },
              { email: { contains: args.search, mode: "insensitive" } },
              { tax_code: { contains: args.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return prisma.customer.findMany({
      where,
      include: CUSTOMER_INCLUDE,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
    });
  },

  deleteCustomerAddresses: (tx: CustomerTransaction, customerId: number) =>
    tx.customerAddress.deleteMany({
      where: { customer_id: customerId },
    }),

  updateCustomer: (
    tx: CustomerTransaction,
    customerId: number,
    data: Prisma.CustomerUncheckedUpdateInput,
  ) =>
    tx.customer.update({
      where: { id: customerId },
      data,
      include: CUSTOMER_INCLUDE,
    }),

  findCustomerCategories: (storeId: string) =>
    prisma.customerCategory.findMany({
      where: { is_active: true, store_id: storeId },
      orderBy: [{ category_name: "asc" }],
    }),

  findCustomersByIds: (tx: CustomerTransaction, storeId: string, ids: number[]) =>
    tx.customer.findMany({
      where: { id: { in: ids }, store_id: storeId },
      select: { id: true, phone: true },
    }),

  softDeleteCustomer: (
    tx: CustomerTransaction,
    customerId: number,
    archivedPhone: string,
  ) =>
    tx.customer.update({
      where: { id: customerId },
      data: {
        status: "soft_deleted",
        phone: archivedPhone,
      },
    }),

  restoreCustomer: (
    tx: CustomerTransaction,
    customerId: number,
    restoredPhone: string,
  ) =>
    tx.customer.update({
      where: { id: customerId },
      data: {
        status: "active",
        phone: restoredPhone,
      },
      include: CUSTOMER_INCLUDE,
    }),

  findStates: (isActive?: boolean) =>
    prisma.state.findMany({
      where: isActive === undefined ? undefined : { is_active: isActive },
      orderBy: [{ name: "asc" }],
    }),

  findCities: (args: { stateId?: number; isActive?: boolean }) =>
    prisma.city.findMany({
      where: {
        ...(args.stateId ? { state_id: args.stateId } : {}),
        ...(args.isActive === undefined ? {} : { is_active: args.isActive }),
      },
      orderBy: [{ name: "asc" }],
    }),

  findDistricts: (args: { cityId?: number; isActive?: boolean }) =>
    prisma.district.findMany({
      where: {
        ...(args.cityId ? { city_id: args.cityId } : {}),
        ...(args.isActive === undefined ? {} : { is_active: args.isActive }),
      },
      orderBy: [{ name: "asc" }],
    }),
};

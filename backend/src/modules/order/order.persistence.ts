import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, NotFoundError } from "@/common";
import type { AddressRequestInput } from "./order.types";
import { OrderRepository, type OrderTransaction } from "./order.repository";
import {
  ORDER_CODE_NUMBER_LENGTH,
  ORDER_CODE_PREFIX,
  parseDecimalOrNull,
  parseOptionalPositiveInt,
  toOptionalTrimmedString,
} from "./order.helpers";

export const orderInclude = {
  items: {
    orderBy: [{ id: "asc" }],
    include: {
      product: {
        select: {
          image_url: true,
        },
      },
      variant: {
        select: {
          image_url: true,
          sku: true,
          attribute_values: {
            include: {
              attribute_value: {
                select: {
                  value: true,
                },
              },
            },
          },
        },
      },
    },
  },
  history: {
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  },
  from_address_detail: true,
  to_address_detail: true,
  return_address_detail: true,
} satisfies Prisma.OrderInclude;

export const orderEditInclude = {
  items: {
    orderBy: [{ id: "asc" }],
    include: {
      product: {
        select: {
          image_url: true,
        },
      },
      variant: {
        select: {
          image_url: true,
          sku: true,
          attribute_values: {
            include: {
              attribute_value: {
                select: {
                  value: true,
                },
              },
            },
          },
        },
      },
    },
  },
  from_address_detail: true,
  to_address_detail: true,
  return_address_detail: true,
} satisfies Prisma.OrderInclude;

export const orderMutationInclude = {
  items: {
    orderBy: [{ id: "asc" }],
  },
  from_address_detail: true,
  to_address_detail: true,
  return_address_detail: true,
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

export type OrderForEdit = Prisma.OrderGetPayload<{
  include: typeof orderEditInclude;
}>;

export type OrderForMutation = Prisma.OrderGetPayload<{
  include: typeof orderMutationInclude;
}>;

export const getOrderForMutation = async (storeId: string, id: number) => {
  const order = await OrderRepository.findOrderFirst({
    where: { id, store_id: storeId },
    include: orderMutationInclude,
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  return order;
};

const getOrCreateAddress = async (
  tx: OrderTransaction,
  input: AddressRequestInput | null | undefined,
  fieldName: string,
) => {
  const existingAddressId =
    input?.id === null || input?.id === undefined
      ? null
      : parseOptionalPositiveInt(input.id, `${fieldName}.id`) ?? null;

  if (existingAddressId) {
    const address = await OrderRepository.findAddressByIdTx(tx, existingAddressId);

    if (!address) {
      throw new BadRequestError(`${fieldName}.id is invalid`);
    }

    return address.id;
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  const stateId = parseOptionalPositiveInt(input.state_id, `${fieldName}.state_id`);
  const cityId = parseOptionalPositiveInt(input.city_id, `${fieldName}.city_id`);
  const districtId =
    input.district_id === null || input.district_id === undefined
      ? null
      : parseOptionalPositiveInt(input.district_id, `${fieldName}.district_id`) ?? null;
  const addressLine = toOptionalTrimmedString(input.address_line);

  if (!stateId) {
    throw new BadRequestError(`${fieldName}.state_id is required`);
  }

  if (!cityId) {
    throw new BadRequestError(`${fieldName}.city_id is required`);
  }

  if (!addressLine) {
    throw new BadRequestError(`${fieldName}.address_line is required`);
  }

  const [state, city, district] = await Promise.all([
    OrderRepository.findStateByIdTx(tx, stateId),
    OrderRepository.findCityByIdTx(tx, cityId),
    districtId
      ? OrderRepository.findDistrictByIdTx(tx, districtId)
      : Promise.resolve(null),
  ]);

  if (!state) {
    throw new BadRequestError(`${fieldName}.state_id is invalid`);
  }

  if (!city || city.state_id !== state.id) {
    throw new BadRequestError(`${fieldName}.city_id is invalid for the selected state`);
  }

  if (districtId && (!district || district.city_id !== city.id)) {
    throw new BadRequestError(`${fieldName}.district_id is invalid for the selected city`);
  }

  const address = await OrderRepository.createAddressTx(tx, {
    state_id: state.id,
    city_id: city.id,
    district_id: district?.id ?? null,
    address_line: addressLine,
    address_line2: toOptionalTrimmedString(input.address_line2) ?? null,
    state_name: state.name,
    city_name: city.name,
    district_name: district?.name ?? null,
    postal_code: toOptionalTrimmedString(input.postal_code) ?? null,
    country_code: toOptionalTrimmedString(input.country_code) ?? "VN",
    latitude: parseDecimalOrNull(input.latitude, `${fieldName}.latitude`),
    longitude: parseDecimalOrNull(input.longitude, `${fieldName}.longitude`),
    note: toOptionalTrimmedString(input.note) ?? null,
  });

  return address.id;
};

export const resolveOrderAddressId = async (
  tx: OrderTransaction,
  explicitAddressId: number | null,
  addressInput: AddressRequestInput | null | undefined,
  fieldName: string,
) => {
  if (explicitAddressId) {
    const address = await OrderRepository.findAddressByIdTx(tx, explicitAddressId);

    if (!address) {
      throw new BadRequestError(`${fieldName}_id is invalid`);
    }

    return address.id;
  }

  return getOrCreateAddress(tx, addressInput, `${fieldName}_detail`);
};

export const persistOrderMutation = async ({
  orderId,
  data,
  historyEntry,
  beforeUpdate,
}: {
  orderId: number;
  data: Prisma.OrderUpdateInput;
  historyEntry?: {
    event_type: string;
    description: string;
    actor_name: string | null;
    metadata: Prisma.InputJsonValue;
  };
  beforeUpdate?: (tx: OrderTransaction) => Promise<void>;
}) => {
  const updatedOrderId = await OrderRepository.withTransaction(
    async (tx) => {
      if (beforeUpdate) {
        await beforeUpdate(tx);
      }

      if (historyEntry) {
        await OrderRepository.createOrderHistoryTx(tx, {
          data: {
            order: { connect: { id: orderId } },
            event_type: historyEntry.event_type,
            description: historyEntry.description,
            actor_name: historyEntry.actor_name,
            metadata: historyEntry.metadata,
          },
        });
      }

      const updatedOrder = await OrderRepository.updateOrderTx(tx, {
        where: { id: orderId },
        data,
      });

      return updatedOrder.id;
    },
    {
      maxWait: 10_000,
      timeout: 20_000,
    },
  );

  const updatedOrder = await OrderRepository.findOrderUnique({
    where: { id: updatedOrderId },
    include: orderInclude,
  });

  if (!updatedOrder) {
    throw new NotFoundError("Order not found after update");
  }

  return updatedOrder;
};

export const generateNextOrderCode = async (tx: OrderTransaction, storeId: string) => {
  const counter = await OrderRepository.upsertOrderCodeCounterTx(tx, storeId);
  const nextSequence = counter.last_sequence;

  return `${ORDER_CODE_PREFIX}${String(nextSequence).padStart(ORDER_CODE_NUMBER_LENGTH, "0")}`;
};

export const isDuplicateGeneratedOrderCodeError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const targets = Array.isArray(error.meta?.target) ? error.meta.target : [];
  return targets.includes("order_code");
};

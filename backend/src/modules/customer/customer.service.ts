import { prisma } from "@lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, NotFoundError } from "@/common";
import type {
  CustomerListQuery,
  CustomerRequestInput,
  CustomerStatusInput,
  LocationListQuery,
} from "./customer.types";

const CUSTOMER_STATUSES: CustomerStatusInput[] = ["active", "inactive", "deleted"];
const CUSTOMER_CODE_PREFIX = "KH";
const CUSTOMER_CODE_NUMBER_LENGTH = 4;
const CUSTOMER_CODE_GENERATION_RETRIES = 5;

const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseOptionalPositiveInt = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

const parseOptionalBoolean = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  throw new BadRequestError(`${fieldName} must be true or false`);
};

const parseCustomerStatus = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string" && CUSTOMER_STATUSES.includes(value as CustomerStatusInput)) {
    return value as CustomerStatusInput;
  }

  throw new BadRequestError("status must be one of: active, inactive, deleted");
};

const generateNextCustomerCode = async (tx: Prisma.TransactionClient) => {
  const codeRegex = `${CUSTOMER_CODE_PREFIX}([0-9]+)$`;
  const matchingPattern = `^${CUSTOMER_CODE_PREFIX}[0-9]+$`;
  const rows = await tx.$queryRaw<Array<{ max_sequence: number | null }>>(Prisma.sql`
    SELECT MAX(SUBSTRING(client_code FROM ${codeRegex})::integer) AS max_sequence
    FROM customers
    WHERE client_code ~ ${matchingPattern}
  `);
  const nextSequence = (rows[0]?.max_sequence ?? 0) + 1;

  return `${CUSTOMER_CODE_PREFIX}${String(nextSequence).padStart(CUSTOMER_CODE_NUMBER_LENGTH, "0")}`;
};

const isDuplicateGeneratedCustomerCodeError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const targets = Array.isArray(error.meta?.target) ? error.meta.target : [];
  return targets.includes("client_code");
};

export const CustomerService = {
  createCustomer: async (input: CustomerRequestInput) => {
    const clientCode = toOptionalTrimmedString(input.client_code);
    const fullName = toOptionalTrimmedString(input.full_name);
    const phone = toOptionalTrimmedString(input.phone);
    const customerCategoryId =
      input.customer_category_id === null || input.customer_category_id === undefined
        ? null
        : parseOptionalPositiveInt(input.customer_category_id, "customer_category_id");
    const status = input.status ?? "active";

    if (!fullName) {
      throw new BadRequestError("full_name is required");
    }

    if (!phone) {
      throw new BadRequestError("phone is required");
    }

    if (!["active", "inactive"].includes(status)) {
      throw new BadRequestError("status must be one of: active, inactive");
    }

    for (let attempt = 0; attempt < CUSTOMER_CODE_GENERATION_RETRIES; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const resolvedClientCode = clientCode ?? (await generateNextCustomerCode(tx));

          const [existingClientCode, existingPhone, category] = await Promise.all([
            tx.customer.findFirst({
              where: { client_code: resolvedClientCode },
              select: { id: true },
            }),
            tx.customer.findFirst({
              where: { phone },
              select: { id: true },
            }),
            customerCategoryId
              ? tx.customerCategory.findUnique({
                  where: { id: customerCategoryId },
                  select: { id: true },
                })
              : Promise.resolve(null),
          ]);

          if (existingClientCode) {
            throw new BadRequestError(`Customer code "${resolvedClientCode}" already exists`);
          }

          if (existingPhone) {
            throw new BadRequestError(`Phone "${phone}" already exists`);
          }

          if (customerCategoryId && !category) {
            throw new BadRequestError("customer_category_id is invalid");
          }

          const customer = await tx.customer.create({
            data: {
              client_code: resolvedClientCode,
              full_name: fullName,
              phone,
              status,
              customer_category_id: customerCategoryId,
            },
            include: {
              customer_category: true,
              orders: {
                select: { order_date: true },
                orderBy: { order_date: "desc" },
                take: 1,
              },
            },
          });

          return {
            id: customer.id,
            client_code: customer.client_code,
            full_name: customer.full_name,
            phone: customer.phone,
            status: customer.status,
            created_at: customer.created_at.toISOString(),
            updated_at: customer.updated_at.toISOString(),
            customer_category_id: customer.customer_category_id,
            customer_category: customer.customer_category
              ? {
                  id: customer.customer_category.id,
                  category_code: customer.customer_category.category_code,
                  category_name: customer.customer_category.category_name,
                }
              : null,
            last_purchased_at: customer.orders[0]?.order_date.toISOString() ?? null,
          };
        });
      } catch (error) {
        if (clientCode || !isDuplicateGeneratedCustomerCodeError(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestError("Unable to generate a unique customer code");
  },

  getCustomers: async (query: CustomerListQuery) => {
    const search = toOptionalTrimmedString(query.search)?.toLowerCase();
    const status = parseCustomerStatus(query.status);
    const customerCategoryId = parseOptionalPositiveInt(
      query.customer_category_id,
      "customer_category_id",
    );

    const customers = await prisma.customer.findMany({
      where: {
        ...(status ? { status } : { status: { not: "deleted" } }),
        ...(customerCategoryId ? { customer_category_id: customerCategoryId } : {}),
        ...(search
          ? {
              OR: [
                { client_code: { contains: search, mode: "insensitive" } },
                { full_name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        customer_category: true,
        orders: {
          select: { order_date: true },
          orderBy: { order_date: "desc" },
          take: 1,
        },
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
    });

    return customers.map((customer) => ({
      id: customer.id,
      client_code: customer.client_code,
      full_name: customer.full_name,
      phone: customer.phone,
      status: customer.status,
      created_at: customer.created_at.toISOString(),
      updated_at: customer.updated_at.toISOString(),
      customer_category_id: customer.customer_category_id,
      customer_category: customer.customer_category
        ? {
            id: customer.customer_category.id,
            category_code: customer.customer_category.category_code,
            category_name: customer.customer_category.category_name,
          }
        : null,
      last_purchased_at: customer.orders[0]?.order_date.toISOString() ?? null,
    }));
  },

  getCustomerCategories: async () => {
    const categories = await prisma.customerCategory.findMany({
      where: { is_active: true },
      orderBy: [{ category_name: "asc" }],
    });

    return categories.map((category) => ({
      id: category.id,
      category_code: category.category_code,
      category_name: category.category_name,
      normalized_name: category.normalized_name,
      is_active: category.is_active,
      created_at: category.created_at.toISOString(),
      updated_at: category.updated_at.toISOString(),
    }));
  },

  deleteCustomers: async (ids: number[]) => {
    const uniqueIds = [...new Set(ids)];

    return prisma.$transaction(async (tx) => {
      const existingCustomers = await tx.customer.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });

      if (existingCustomers.length !== uniqueIds.length) {
        throw new NotFoundError("One or more customers were not found");
      }

      const customerIds = existingCustomers.map((customer) => customer.id);

      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: { status: "deleted" },
      });

      return {
        deleted_ids: customerIds,
      };
    });
  },

  getStates: async (query: LocationListQuery) => {
    const isActive = parseOptionalBoolean(query.is_active, "is_active");

    const states = await prisma.state.findMany({
      where: isActive === undefined ? undefined : { is_active: isActive },
      orderBy: [{ name: "asc" }],
    });

    return states.map((state) => ({
      id: state.id,
      code: state.code,
      name: state.name,
      normalized_name: state.normalized_name,
      is_active: state.is_active,
      created_at: state.created_at.toISOString(),
      updated_at: state.updated_at.toISOString(),
    }));
  },

  getCities: async (query: LocationListQuery) => {
    const stateId = parseOptionalPositiveInt(query.state_id, "state_id");
    const isActive = parseOptionalBoolean(query.is_active, "is_active");

    const cities = await prisma.city.findMany({
      where: {
        ...(stateId ? { state_id: stateId } : {}),
        ...(isActive === undefined ? {} : { is_active: isActive }),
      },
      orderBy: [{ name: "asc" }],
    });

    return cities.map((city) => ({
      id: city.id,
      state_id: city.state_id,
      code: city.code,
      name: city.name,
      normalized_name: city.normalized_name,
      is_active: city.is_active,
      created_at: city.created_at.toISOString(),
      updated_at: city.updated_at.toISOString(),
    }));
  },

  getDistricts: async (query: LocationListQuery) => {
    const cityId = parseOptionalPositiveInt(query.city_id, "city_id");
    const isActive = parseOptionalBoolean(query.is_active, "is_active");

    const districts = await prisma.district.findMany({
      where: {
        ...(cityId ? { city_id: cityId } : {}),
        ...(isActive === undefined ? {} : { is_active: isActive }),
      },
      orderBy: [{ name: "asc" }],
    });

    return districts.map((district) => ({
      id: district.id,
      city_id: district.city_id,
      code: district.code,
      name: district.name,
      normalized_name: district.normalized_name,
      is_active: district.is_active,
      created_at: district.created_at.toISOString(),
      updated_at: district.updated_at.toISOString(),
    }));
  },
};

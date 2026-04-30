import { prisma } from "@lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, NotFoundError } from "@/common";
import type {
  AddressRequestInput,
  CustomerAddressRequestInput,
  CustomerAddressTypeInput,
  CustomerGenderInput,
  CustomerListQuery,
  CustomerRequestInput,
  CustomerStatusInput,
  LocationListQuery,
  UpdateCustomerRequestInput,
} from "./customer.types";

const CUSTOMER_STATUSES: CustomerStatusInput[] = ["active", "inactive", "soft_deleted", "deleted"];
const LIVE_CUSTOMER_STATUSES: CustomerStatusInput[] = ["active", "inactive"];
const DELETED_CUSTOMER_STATUSES: CustomerStatusInput[] = ["soft_deleted", "deleted"];
const CUSTOMER_GENDERS: CustomerGenderInput[] = ["male", "female", "other"];
const CUSTOMER_ADDRESS_TYPES: CustomerAddressTypeInput[] = [
  "billing",
  "shipping",
  "office",
  "warehouse",
  "other",
];
const CUSTOMER_CODE_PREFIX = "KH";
const CUSTOMER_CODE_NUMBER_LENGTH = 4;
const CUSTOMER_CODE_GENERATION_RETRIES = 5;
const ARCHIVED_PHONE_PREFIX = "__archived__";

const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizePhone = (value: unknown, fieldName = "phone") => {
  const raw = toOptionalTrimmedString(value);

  if (!raw) {
    return undefined;
  }

  let normalized = raw.replace(/[^\d+]/g, "");

  if (normalized.startsWith("+84")) {
    normalized = `0${normalized.slice(3)}`;
  } else if (normalized.startsWith("0084")) {
    normalized = `0${normalized.slice(4)}`;
  } else if (normalized.startsWith("84") && normalized.length >= 10) {
    normalized = `0${normalized.slice(2)}`;
  }

  normalized = normalized.replace(/\D/g, "");

  if (normalized.length < 8 || normalized.length > 15) {
    throw new BadRequestError(`${fieldName} is invalid`);
  }

  return normalized;
};

const archivePhone = (customerId: number, phone: string) => `${ARCHIVED_PHONE_PREFIX}${customerId}__${phone}`;

const restoreArchivedPhone = (value: string) => {
  if (!value.startsWith(ARCHIVED_PHONE_PREFIX)) {
    return value;
  }

  const parts = value.split("__");
  const originalPhone = parts[parts.length - 1]?.trim();
  return originalPhone || undefined;
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

const parseDecimalOrNull = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  try {
    return new Prisma.Decimal(value as string | number | Prisma.Decimal);
  } catch {
    throw new BadRequestError(`${fieldName} must be a valid number`);
  }
};

const parseCustomerStatus = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string" && CUSTOMER_STATUSES.includes(value as CustomerStatusInput)) {
    return value as CustomerStatusInput;
  }

  throw new BadRequestError("status must be one of: active, inactive, soft_deleted, deleted");
};

const parseCustomerGender = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string" && CUSTOMER_GENDERS.includes(value as CustomerGenderInput)) {
    return value as CustomerGenderInput;
  }

  throw new BadRequestError(`gender must be one of: ${CUSTOMER_GENDERS.join(", ")}`);
};

const parseOptionalDate = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }

  return date;
};

const generateNextCustomerCode = async (tx: Prisma.TransactionClient) => {
  const codeRegex = `${CUSTOMER_CODE_PREFIX}([0-9]+)$`;
  const matchingPattern = `^${CUSTOMER_CODE_PREFIX}[0-9]+$`;
  const rows = await tx.$queryRaw<Array<{ max_sequence: number | null }>>(Prisma.sql`
    SELECT MAX(SUBSTRING(client_code FROM ${codeRegex})::integer) AS max_sequence
    FROM "Customer"
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

const parseCustomerAddressType = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "shipping" as const;
  }

  if (typeof value === "string" && CUSTOMER_ADDRESS_TYPES.includes(value as CustomerAddressTypeInput)) {
    return value as CustomerAddressTypeInput;
  }

  throw new BadRequestError(`address type must be one of: ${CUSTOMER_ADDRESS_TYPES.join(", ")}`);
};

const getOrCreateAddress = async (
  tx: Prisma.TransactionClient,
  input: AddressRequestInput | null | undefined,
  fieldName: string,
) => {
  const existingAddressId =
    input?.id === null || input?.id === undefined
      ? null
      : parseOptionalPositiveInt(input.id, `${fieldName}.id`) ?? null;

  if (existingAddressId) {
    const address = await tx.address.findUnique({
      where: { id: existingAddressId },
      select: { id: true },
    });

    if (!address) {
      throw new BadRequestError(`${fieldName}.id is invalid`);
    }

    return address.id;
  }

  if (!input || typeof input !== "object") {
    throw new BadRequestError(`${fieldName} is required`);
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
    tx.state.findUnique({ where: { id: stateId }, select: { id: true, name: true } }),
    tx.city.findUnique({ where: { id: cityId }, select: { id: true, state_id: true, name: true } }),
    districtId
      ? tx.district.findUnique({
          where: { id: districtId },
          select: { id: true, city_id: true, name: true },
        })
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

  const address = await tx.address.create({
    data: {
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
    },
    select: { id: true },
  });

  return address.id;
};

const mapAddress = (address: {
  id: number;
  state_id: number;
  city_id: number;
  district_id: number | null;
  address_line: string;
  address_line2: string | null;
  state_name: string;
  city_name: string;
  district_name: string | null;
  postal_code: string | null;
  country_code: string;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  note: string | null;
}) => ({
  id: address.id,
  state_id: address.state_id,
  city_id: address.city_id,
  district_id: address.district_id,
  address_line: address.address_line,
  address_line2: address.address_line2,
  state_name: address.state_name,
  city_name: address.city_name,
  district_name: address.district_name,
  postal_code: address.postal_code,
  country_code: address.country_code,
  latitude: address.latitude?.toString() ?? null,
  longitude: address.longitude?.toString() ?? null,
  note: address.note,
});

const mapCustomer = (customer: Prisma.CustomerGetPayload<{
  include: {
    customer_category: true;
    orders: { select: { order_date: true } };
    addresses: { include: { address: true } };
  };
}>) => ({
  id: customer.id,
  client_code: customer.client_code,
  full_name: customer.full_name,
  phone: restoreArchivedPhone(customer.phone ?? "") ?? customer.phone ?? "",
  email: customer.email,
  birth_date: customer.birth_date?.toISOString() ?? null,
  gender: customer.gender,
  tax_code: customer.tax_code,
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
  addresses: customer.addresses.map((item) => ({
    id: item.id,
    type: item.type,
    label: item.label,
    is_default: item.is_default,
    recipient_name: item.recipient_name,
    recipient_phone: item.recipient_phone,
    note: item.note,
    address: mapAddress(item.address),
  })),
  last_purchased_at: customer.orders[0]?.order_date.toISOString() ?? null,
});

const normalizeCustomerAddresses = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  addresses: CustomerAddressRequestInput[] | undefined,
) => {
  if (!addresses) {
    return;
  }

  for (const [index, item] of addresses.entries()) {
    const fieldName = `addresses[${index}]`;
    const addressId =
      item.address_id === null || item.address_id === undefined
        ? await getOrCreateAddress(tx, item.address, `${fieldName}.address`)
        : parseOptionalPositiveInt(item.address_id, `${fieldName}.address_id`);

    if (!addressId) {
      throw new BadRequestError(`${fieldName}.address_id is required`);
    }

    const existingAddress = await tx.address.findUnique({
      where: { id: addressId },
      select: { id: true },
    });

    if (!existingAddress) {
      throw new BadRequestError(`${fieldName}.address_id is invalid`);
    }

    await tx.customerAddress.create({
      data: {
        customer_id: customerId,
        address_id: addressId,
        type: parseCustomerAddressType(item.type),
        label: toOptionalTrimmedString(item.label) ?? null,
        is_default: item.is_default ?? false,
        recipient_name: toOptionalTrimmedString(item.recipient_name) ?? null,
        recipient_phone: toOptionalTrimmedString(item.recipient_phone) ?? null,
        note: toOptionalTrimmedString(item.note) ?? null,
      },
    });
  }
};

const customerInclude = {
  customer_category: true,
  orders: {
    select: { order_date: true },
    orderBy: { order_date: "desc" },
    take: 1,
  },
  addresses: {
    include: { address: true },
    orderBy: [{ is_default: "desc" }, { id: "asc" }],
  },
} satisfies Prisma.CustomerInclude;

const getCustomerByIdOrThrow = async (storeId: string, id: number) => {
  const customer = await prisma.customer.findFirst({
    where: { id, store_id: storeId },
    include: customerInclude,
  });

  if (!customer) {
    throw new NotFoundError("Customer not found");
  }

  return customer;
};

const ensurePhoneIsAvailable = async (
  tx: Prisma.TransactionClient,
  storeId: string,
  phone: string,
  currentCustomerId?: number,
) => {
  const existingPhone = await tx.customer.findFirst({
    where: {
      store_id: storeId,
      phone,
      status: { in: LIVE_CUSTOMER_STATUSES },
      ...(currentCustomerId ? { id: { not: currentCustomerId } } : {}),
    },
    select: { id: true, client_code: true },
  });

  if (existingPhone) {
    throw new BadRequestError("Số điện thoại này đã được sử dụng bởi khách hàng khác");
  }
};

const replaceCustomerAddresses = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  addresses: CustomerAddressRequestInput[] | undefined,
) => {
  if (addresses === undefined) {
    return;
  }

  await tx.customerAddress.deleteMany({
    where: { customer_id: customerId },
  });

  await normalizeCustomerAddresses(tx, customerId, addresses);
};

export const CustomerService = {
  createCustomer: async (storeId: string, input: CustomerRequestInput) => {
    const clientCode = toOptionalTrimmedString(input.client_code);
    const fullName = toOptionalTrimmedString(input.full_name);
    const phone = normalizePhone(input.phone);
    const email = toOptionalTrimmedString(input.email) ?? null;
    const birthDate = parseOptionalDate(input.birth_date, "birth_date");
    const gender = parseCustomerGender(input.gender);
    const taxCode = toOptionalTrimmedString(input.tax_code) ?? null;
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
              where: { client_code: resolvedClientCode, store_id: storeId },
              select: { id: true },
            }),
            tx.customer.findFirst({
              where: {
                store_id: storeId,
                phone,
                status: { in: LIVE_CUSTOMER_STATUSES },
              },
              select: { id: true },
            }),
            customerCategoryId
              ? tx.customerCategory.findFirst({
                  where: { id: customerCategoryId, store_id: storeId },
                  select: { id: true },
                })
              : Promise.resolve(null),
          ]);

          if (existingClientCode) {
            throw new BadRequestError(`Customer code "${resolvedClientCode}" already exists`);
          }

          if (existingPhone) {
            throw new BadRequestError("Số điện thoại này đã được sử dụng bởi khách hàng khác");
          }

          if (customerCategoryId && !category) {
            throw new BadRequestError("customer_category_id is invalid");
          }

          const customer = await tx.customer.create({
            data: {
              client_code: resolvedClientCode,
              full_name: fullName,
              phone,
              email,
              birth_date: birthDate,
              gender,
              tax_code: taxCode,
              status,
              customer_category_id: customerCategoryId,
              store_id: storeId,
            },
            include: customerInclude,
          });

          await normalizeCustomerAddresses(tx, customer.id, input.addresses);

          const customerWithAddresses = await tx.customer.findFirstOrThrow({
            where: { id: customer.id, store_id: storeId },
            include: customerInclude,
          });

          return mapCustomer(customerWithAddresses);
        });
      } catch (error) {
        if (clientCode || !isDuplicateGeneratedCustomerCodeError(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestError("Unable to generate a unique customer code");
  },

  getCustomers: async (storeId: string, query: CustomerListQuery) => {
    const search = toOptionalTrimmedString(query.search)?.toLowerCase();
    const status = parseCustomerStatus(query.status);
    const customerCategoryId = parseOptionalPositiveInt(
      query.customer_category_id,
      "customer_category_id",
    );

    const customers = await prisma.customer.findMany({
      where: {
        store_id: storeId,
        ...(status ? { status } : { status: { notIn: DELETED_CUSTOMER_STATUSES } }),
        ...(customerCategoryId ? { customer_category_id: customerCategoryId } : {}),
        ...(search
          ? {
              OR: [
                { client_code: { contains: search, mode: "insensitive" } },
                { full_name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { tax_code: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: customerInclude,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
    });

    return customers.map(mapCustomer);
  },

  getCustomerById: async (storeId: string, id: number) => {
    return mapCustomer(await getCustomerByIdOrThrow(storeId, id));
  },

  updateCustomer: async (storeId: string, id: number, input: UpdateCustomerRequestInput) => {
    const existingCustomer = await getCustomerByIdOrThrow(storeId, id);

    if (DELETED_CUSTOMER_STATUSES.includes(existingCustomer.status)) {
      throw new BadRequestError("Soft deleted customers must be restored before editing");
    }

    const fullName =
      input.full_name === undefined
        ? existingCustomer.full_name
        : toOptionalTrimmedString(input.full_name);
    const phone =
      input.phone === undefined
        ? existingCustomer.phone
        : normalizePhone(input.phone);
    const email =
      input.email === undefined
        ? existingCustomer.email
        : toOptionalTrimmedString(input.email) ?? null;
    const birthDate =
      input.birth_date === undefined
        ? existingCustomer.birth_date
        : parseOptionalDate(input.birth_date, "birth_date");
    const gender =
      input.gender === undefined ? existingCustomer.gender : parseCustomerGender(input.gender);
    const taxCode =
      input.tax_code === undefined
        ? existingCustomer.tax_code
        : toOptionalTrimmedString(input.tax_code) ?? null;
    const status = input.status === undefined ? existingCustomer.status : parseCustomerStatus(input.status);
    const customerCategoryId =
      input.customer_category_id === undefined
        ? existingCustomer.customer_category_id
        : input.customer_category_id === null
          ? null
          : parseOptionalPositiveInt(input.customer_category_id, "customer_category_id") ?? null;

    if (!fullName) {
      throw new BadRequestError("full_name is required");
    }

    if (!phone) {
      throw new BadRequestError("phone is required");
    }

    if (!status || DELETED_CUSTOMER_STATUSES.includes(status)) {
      throw new BadRequestError("status must be one of: active, inactive");
    }

    const updatedCustomer = await prisma.$transaction(async (tx) => {
      const [existingClientCode, category] = await Promise.all([
        input.client_code
          ? tx.customer.findFirst({
              where: {
                client_code: input.client_code,
                store_id: storeId,
                id: { not: id },
              },
              select: { id: true },
            })
          : Promise.resolve(null),
        customerCategoryId
          ? tx.customerCategory.findFirst({
              where: { id: customerCategoryId, store_id: storeId },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

      if (existingClientCode) {
        throw new BadRequestError(`Customer code "${input.client_code}" already exists`);
      }

      if (customerCategoryId && !category) {
        throw new BadRequestError("customer_category_id is invalid");
      }

      if (phone !== existingCustomer.phone) {
        await ensurePhoneIsAvailable(tx, storeId, phone, id);
      }

      await replaceCustomerAddresses(tx, id, input.addresses);

      return tx.customer.update({
        where: { id },
        data: {
          client_code: toOptionalTrimmedString(input.client_code) ?? existingCustomer.client_code,
          full_name: fullName,
          phone,
          email,
          birth_date: birthDate,
          gender,
          tax_code: taxCode,
          status,
          customer_category_id: customerCategoryId,
        },
        include: customerInclude,
      });
    });

    return mapCustomer(updatedCustomer);
  },

  getCustomerCategories: async (storeId: string) => {
    const categories = await prisma.customerCategory.findMany({
      where: { is_active: true, store_id: storeId },
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

  deleteCustomers: async (storeId: string, ids: number[]) => {
    const uniqueIds = [...new Set(ids)];

    return prisma.$transaction(async (tx) => {
      const existingCustomers = await tx.customer.findMany({
        where: { id: { in: uniqueIds }, store_id: storeId },
        select: { id: true, phone: true },
      });

      if (existingCustomers.length !== uniqueIds.length) {
        throw new NotFoundError("One or more customers were not found");
      }

      const customerIds = existingCustomers.map((customer) => customer.id);

      for (const customer of existingCustomers) {
        if (!customer.phone) {
          throw new BadRequestError(`Customer ${customer.id} is missing phone and cannot be soft deleted safely`);
        }

        await tx.customer.update({
          where: { id: customer.id },
          data: {
            status: "soft_deleted",
            phone: archivePhone(customer.id, customer.phone),
          },
        });
      }

      return {
        deleted_ids: customerIds,
      };
    });
  },

  restoreCustomer: async (storeId: string, id: number) => {
    const existingCustomer = await getCustomerByIdOrThrow(storeId, id);

    if (!DELETED_CUSTOMER_STATUSES.includes(existingCustomer.status)) {
      return mapCustomer(existingCustomer);
    }

    const restoredCustomer = await prisma.$transaction(async (tx) => {
      const restoredPhone = restoreArchivedPhone(existingCustomer.phone ?? "");

      if (!restoredPhone) {
        throw new BadRequestError("Customer phone could not be restored from archived data");
      }

      const conflictingCustomer = await tx.customer.findFirst({
        where: {
          store_id: storeId,
          phone: restoredPhone,
          status: { in: LIVE_CUSTOMER_STATUSES },
          id: { not: id },
        },
        select: { id: true },
      });

      if (conflictingCustomer) {
        throw new BadRequestError("Số điện thoại này đã được sử dụng bởi khách hàng khác");
      }

      return tx.customer.update({
        where: { id },
        data: {
          status: "active",
          phone: restoredPhone,
        },
        include: customerInclude,
      });
    });

    return mapCustomer(restoredCustomer);
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

import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, NotFoundError } from "@/common";
import {
  CustomerRepository,
  type CustomerRecord,
  type CustomerTransaction,
} from "./customer.repository";
import type {
  AddressRequestInput,
  CustomerAddressRequestInput,
  CustomerAddressTypeInput,
  CustomerGenderInput,
  CustomerInvoiceProfileInput,
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
  return CustomerRepository.generateNextCustomerCode(
    tx,
    CUSTOMER_CODE_PREFIX,
    CUSTOMER_CODE_NUMBER_LENGTH,
  );
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
  tx: CustomerTransaction,
  input: AddressRequestInput | null | undefined,
  fieldName: string,
) => {
  const existingAddressId =
    input?.id === null || input?.id === undefined
      ? null
      : parseOptionalPositiveInt(input.id, `${fieldName}.id`) ?? null;

  if (existingAddressId) {
    const address = await CustomerRepository.findAddressById(tx, existingAddressId);

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

  const [state, city, district] = await CustomerRepository.findLocationRefs(
    tx,
    stateId,
    cityId,
    districtId,
  );

  if (!state) {
    throw new BadRequestError(`${fieldName}.state_id is invalid`);
  }

  if (!city || city.state_id !== state.id) {
    throw new BadRequestError(`${fieldName}.city_id is invalid for the selected state`);
  }

  if (districtId && (!district || district.city_id !== city.id)) {
    throw new BadRequestError(`${fieldName}.district_id is invalid for the selected city`);
  }

  const address = await CustomerRepository.createAddress(tx, {
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

const normalizeInvoiceProfile = (
  input: CustomerInvoiceProfileInput | null | undefined,
  fallback?: {
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
    taxCode?: string | null;
    existing?: Record<string, unknown>;
  },
) => {
  const existing = fallback?.existing ?? {};

  const entityType =
    input?.entity_type === "business" || input?.entity_type === "individual"
      ? input.entity_type
      : (existing.entity_type as "business" | "individual" | undefined) ?? "individual";

  const buyerName =
    toOptionalTrimmedString(input?.buyer_name) ??
    (typeof existing.buyer_name === "string" ? existing.buyer_name.trim() : undefined) ??
    fallback?.fullName ??
    "";
  const phone =
    normalizePhone(input?.phone, "invoice_profile.phone") ??
    (typeof existing.phone === "string" ? existing.phone.trim() : undefined) ??
    fallback?.phone ??
    "";
  const email =
    toOptionalTrimmedString(input?.email) ??
    (typeof existing.email === "string" ? existing.email.trim() : undefined) ??
    fallback?.email ??
    "";
  const taxCode =
    toOptionalTrimmedString(input?.tax_code) ??
    (typeof existing.tax_code === "string" ? existing.tax_code.trim() : undefined) ??
    fallback?.taxCode ??
    "";

  return {
    entity_type: entityType,
    company_name:
      toOptionalTrimmedString(input?.company_name) ??
      (typeof existing.company_name === "string" ? existing.company_name.trim() : ""),
    buyer_name: buyerName,
    tax_code: taxCode,
    personal_id:
      toOptionalTrimmedString(input?.personal_id) ??
      (typeof existing.personal_id === "string" ? existing.personal_id.trim() : ""),
    budget_unit_code:
      toOptionalTrimmedString(input?.budget_unit_code) ??
      (typeof existing.budget_unit_code === "string" ? existing.budget_unit_code.trim() : ""),
    email,
    phone,
    address_line:
      toOptionalTrimmedString(input?.address_line) ??
      (typeof existing.address_line === "string" ? existing.address_line.trim() : ""),
    note:
      toOptionalTrimmedString(input?.note) ??
      (typeof existing.note === "string" ? existing.note.trim() : ""),
  };
};

const mapCustomer = (customer: CustomerRecord) => ({
  id: customer.id,
  client_code: customer.client_code,
  full_name: customer.full_name,
  phone: restoreArchivedPhone(customer.phone ?? "") ?? customer.phone ?? "",
  email: customer.email,
  birth_date: customer.birth_date?.toISOString() ?? null,
  gender: customer.gender,
  tax_code: customer.tax_code,
  invoice_profile: normalizeInvoiceProfile(null, {
    fullName: customer.full_name,
    phone: restoreArchivedPhone(customer.phone ?? "") ?? customer.phone ?? "",
    email: customer.email,
    taxCode: customer.tax_code,
    existing:
      customer.invoice_profile_json &&
      typeof customer.invoice_profile_json === "object" &&
      !Array.isArray(customer.invoice_profile_json)
        ? (customer.invoice_profile_json as Record<string, unknown>)
        : {},
  }),
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
  tx: CustomerTransaction,
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

    const existingAddress = await CustomerRepository.findAddressById(tx, addressId);

    if (!existingAddress) {
      throw new BadRequestError(`${fieldName}.address_id is invalid`);
    }

    await CustomerRepository.createCustomerAddress(tx, {
      customer_id: customerId,
      address_id: addressId,
      type: parseCustomerAddressType(item.type),
      label: toOptionalTrimmedString(item.label) ?? null,
      is_default: item.is_default ?? false,
      recipient_name: toOptionalTrimmedString(item.recipient_name) ?? null,
      recipient_phone: toOptionalTrimmedString(item.recipient_phone) ?? null,
      note: toOptionalTrimmedString(item.note) ?? null,
    });
  }
};

const getCustomerByIdOrThrow = async (storeId: string, id: number) => {
  const customer = await CustomerRepository.findCustomerByIdWithRelations(storeId, id);

  if (!customer) {
    throw new NotFoundError("Customer not found");
  }

  return customer;
};

const ensurePhoneIsAvailable = async (
  tx: CustomerTransaction,
  storeId: string,
  phone: string,
  currentCustomerId?: number,
) => {
  const existingPhone = await CustomerRepository.findLiveCustomerByPhone(
    tx,
    storeId,
    phone,
    LIVE_CUSTOMER_STATUSES,
    currentCustomerId,
  );

  if (existingPhone) {
    throw new BadRequestError("Số điện thoại này đã được sử dụng bởi khách hàng khác");
  }
};

const replaceCustomerAddresses = async (
  tx: CustomerTransaction,
  customerId: number,
  addresses: CustomerAddressRequestInput[] | undefined,
) => {
  if (addresses === undefined) {
    return;
  }

  await CustomerRepository.deleteCustomerAddresses(tx, customerId);

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
    const invoiceProfile = normalizeInvoiceProfile(input.invoice_profile, {
      fullName,
      phone,
      email,
      taxCode,
    });
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
        return await CustomerRepository.withTransaction(async (tx) => {
          const resolvedClientCode = clientCode ?? (await generateNextCustomerCode(tx));

          const [existingClientCode, existingPhone, category] = await Promise.all([
            CustomerRepository.findCustomerCodeConflict(tx, storeId, resolvedClientCode),
            CustomerRepository.findLiveCustomerByPhone(
              tx,
              storeId,
              phone,
              LIVE_CUSTOMER_STATUSES,
            ),
            customerCategoryId
              ? CustomerRepository.findCustomerCategoryById(tx, storeId, customerCategoryId)
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

          const customer = await CustomerRepository.createCustomer(tx, {
            client_code: resolvedClientCode,
            full_name: fullName,
            phone,
            email,
            birth_date: birthDate,
            gender,
            tax_code: taxCode,
            invoice_profile_json: invoiceProfile,
            status,
            customer_category_id: customerCategoryId,
            store_id: storeId,
          });

          await normalizeCustomerAddresses(tx, customer.id, input.addresses);

          const customerWithAddresses = await CustomerRepository.findCustomerByIdWithRelationsOrThrowInTx(
            tx,
            storeId,
            customer.id,
          );

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

    const customers = await CustomerRepository.findCustomers({
      storeId,
      status,
      excludedStatuses: status ? undefined : DELETED_CUSTOMER_STATUSES,
      customerCategoryId,
      search,
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
    const existingInvoiceProfile =
      existingCustomer.invoice_profile_json &&
      typeof existingCustomer.invoice_profile_json === "object" &&
      !Array.isArray(existingCustomer.invoice_profile_json)
        ? (existingCustomer.invoice_profile_json as Record<string, unknown>)
        : {};
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

    const invoiceProfile = normalizeInvoiceProfile(input.invoice_profile, {
      fullName,
      phone,
      email,
      taxCode,
      existing: existingInvoiceProfile,
    });

    const updatedCustomer = await CustomerRepository.withTransaction(async (tx) => {
      const [existingClientCode, category] = await Promise.all([
        input.client_code
          ? CustomerRepository.findCustomerCodeConflict(tx, storeId, input.client_code, id)
          : Promise.resolve(null),
        customerCategoryId
          ? CustomerRepository.findCustomerCategoryById(tx, storeId, customerCategoryId)
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

      return CustomerRepository.updateCustomer(tx, id, {
        client_code: toOptionalTrimmedString(input.client_code) ?? existingCustomer.client_code,
        full_name: fullName,
        phone,
        email,
        birth_date: birthDate,
        gender,
        tax_code: taxCode,
        invoice_profile_json: invoiceProfile,
        status,
        customer_category_id: customerCategoryId,
      });
    });

    return mapCustomer(updatedCustomer);
  },

  getCustomerCategories: async (storeId: string) => {
    const categories = await CustomerRepository.findCustomerCategories(storeId);

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

    return CustomerRepository.withTransaction(async (tx) => {
      const existingCustomers = await CustomerRepository.findCustomersByIds(tx, storeId, uniqueIds);

      if (existingCustomers.length !== uniqueIds.length) {
        throw new NotFoundError("One or more customers were not found");
      }

      const customerIds = existingCustomers.map((customer) => customer.id);

      for (const customer of existingCustomers) {
        if (!customer.phone) {
          throw new BadRequestError(`Customer ${customer.id} is missing phone and cannot be soft deleted safely`);
        }

        await CustomerRepository.softDeleteCustomer(
          tx,
          customer.id,
          archivePhone(customer.id, customer.phone),
        );
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

    const restoredCustomer = await CustomerRepository.withTransaction(async (tx) => {
      const restoredPhone = restoreArchivedPhone(existingCustomer.phone ?? "");

      if (!restoredPhone) {
        throw new BadRequestError("Customer phone could not be restored from archived data");
      }

      const conflictingCustomer = await CustomerRepository.findLiveCustomerByPhone(
        tx,
        storeId,
        restoredPhone,
        LIVE_CUSTOMER_STATUSES,
        id,
      );

      if (conflictingCustomer) {
        throw new BadRequestError("Số điện thoại này đã được sử dụng bởi khách hàng khác");
      }

      return CustomerRepository.restoreCustomer(tx, id, restoredPhone);
    });

    return mapCustomer(restoredCustomer);
  },

  getStates: async (query: LocationListQuery) => {
    const isActive = parseOptionalBoolean(query.is_active, "is_active");

    const states = await CustomerRepository.findStates(isActive);

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

    const cities = await CustomerRepository.findCities({ stateId, isActive });

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

    const districts = await CustomerRepository.findDistricts({ cityId, isActive });

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

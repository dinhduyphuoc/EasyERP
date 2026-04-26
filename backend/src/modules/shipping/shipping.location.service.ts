import { prisma } from "@lib/prisma";
import { BadRequestError } from "@/common";
import type { GHNClient, GHNDistrictResponse, GHNProvinceResponse, GHNWardResponse } from "@/lib/ghn";
import { Prisma } from "../../../generated/prisma/client";
import type {
  ShippingCanonicalLocationInput,
  ShippingResolvedLocation,
} from "./shipping.types";

type SupportedProviderContext = {
  provider: {
    id: number;
    code: string;
    display_name: string;
  };
  store_id: string;
  client: GHNClient;
};

type InternalLocationRecord = {
  address_id: number | null;
  state: {
    id: number;
    code: string;
    name: string;
    normalized_name: string;
  };
  city: {
    id: number;
    code: string;
    name: string;
    normalized_name: string;
  };
  district: {
    id: number;
    code: string;
    name: string;
    normalized_name: string;
  } | null;
};

type CatalogLevel = "province" | "district" | "ward";

type LocationCandidate = {
  id: number;
  name: string;
  normalized_name: string;
};

const parseOptionalPositiveInt = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

const parseExternalPositiveInt = (value: string, fieldName: string) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} is not a valid provider identifier`);
  }

  return parsed;
};

const toJsonObject = (value: Record<string, unknown>) => value as Prisma.InputJsonObject;

const normalizeLocationText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const trimPrefix = (value: string, prefixes: string[]) => {
  for (const prefix of prefixes) {
    if (value === prefix) {
      return "";
    }

    if (value.startsWith(`${prefix} `)) {
      return value.slice(prefix.length).trim();
    }
  }

  return null;
};

const buildLocationAliases = (value: string, level: CatalogLevel) => {
  const normalized = normalizeLocationText(value);
  const aliases = new Set<string>();

  if (!normalized) {
    return aliases;
  }

  aliases.add(normalized);

  const prefixes =
    level === "province"
      ? ["tinh", "thanh pho", "tp", "tp hcm", "tp ho chi minh"]
      : level === "district"
        ? ["quan", "huyen", "thanh pho", "thi xa", "thi tran", "tp"]
        : ["phuong", "xa", "thi tran"];

  const stripped = trimPrefix(normalized, prefixes);
  if (stripped) {
    aliases.add(stripped);
  }

  if (level === "province") {
    if (normalized === "ho chi minh") {
      aliases.add("tp ho chi minh");
    }

    if (normalized === "tp ho chi minh") {
      aliases.add("ho chi minh");
    }

    if (normalized === "thua thien hue") {
      aliases.add("hue");
    }

    if (normalized === "hue") {
      aliases.add("thua thien hue");
    }
  }

  return aliases;
};

const getLocationMatchScore = (
  internalName: string,
  internalNormalizedName: string,
  providerName: string,
  providerNormalizedName: string,
  level: CatalogLevel,
) => {
  const internalAliases = buildLocationAliases(
    internalNormalizedName || internalName,
    level,
  );
  const providerAliases = buildLocationAliases(
    providerNormalizedName || providerName,
    level,
  );

  if (
    internalAliases.has(providerNormalizedName) ||
    providerAliases.has(internalNormalizedName) ||
    internalNormalizedName === providerNormalizedName
  ) {
    return 120;
  }

  for (const alias of internalAliases) {
    if (providerAliases.has(alias)) {
      return 100;
    }
  }

  return 0;
};

const pickBestLocationCandidate = (
  internalLocation: { name: string; normalized_name: string },
  candidates: LocationCandidate[],
  level: CatalogLevel,
) => {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: getLocationMatchScore(
        internalLocation.name,
        internalLocation.normalized_name,
        candidate.name,
        candidate.normalized_name,
        level,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.id - right.candidate.id);

  if (scored.length === 0) {
    return null;
  }

  if (scored[1] && scored[0].score === scored[1].score) {
    return null;
  }

  return scored[0];
};

const touchConnectionLastSync = async (providerId: number, storeId: string) => {
  await prisma.shippingConnection.updateMany({
    where: {
      provider_id: providerId,
      store_id: storeId,
      status: "connected",
    },
    data: {
      last_sync_at: new Date(),
    },
  });
};

const readCanonicalLocation = async (
  input: ShippingCanonicalLocationInput | null | undefined,
): Promise<InternalLocationRecord> => {
  if (!input || typeof input !== "object") {
    throw new BadRequestError("location is required");
  }

  const addressId = parseOptionalPositiveInt(input.address_id, "location.address_id");

  if (addressId) {
    const address = await prisma.address.findUnique({
      where: { id: addressId },
      include: {
        state: {
          select: {
            id: true,
            code: true,
            name: true,
            normalized_name: true,
          },
        },
        city: {
          select: {
            id: true,
            code: true,
            name: true,
            normalized_name: true,
          },
        },
        district: {
          select: {
            id: true,
            code: true,
            name: true,
            normalized_name: true,
          },
        },
      },
    });

    if (!address) {
      throw new BadRequestError("location.address_id is invalid");
    }

    return {
      address_id: address.id,
      state: address.state,
      city: address.city,
      district: address.district,
    };
  }

  const stateId = parseOptionalPositiveInt(input.state_id, "location.state_id");
  const cityId = parseOptionalPositiveInt(input.city_id, "location.city_id");
  const districtId = parseOptionalPositiveInt(input.district_id, "location.district_id");

  if (!stateId) {
    throw new BadRequestError("location.state_id is required");
  }

  if (!cityId) {
    throw new BadRequestError("location.city_id is required");
  }

  const [state, city, district] = await Promise.all([
    prisma.state.findUnique({
      where: { id: stateId },
      select: {
        id: true,
        code: true,
        name: true,
        normalized_name: true,
      },
    }),
    prisma.city.findUnique({
      where: { id: cityId },
      select: {
        id: true,
        state_id: true,
        code: true,
        name: true,
        normalized_name: true,
      },
    }),
    districtId
      ? prisma.district.findUnique({
          where: { id: districtId },
          select: {
            id: true,
            city_id: true,
            code: true,
            name: true,
            normalized_name: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!state) {
    throw new BadRequestError("location.state_id is invalid");
  }

  if (!city || city.state_id !== state.id) {
    throw new BadRequestError("location.city_id is invalid for the selected state");
  }

  if (districtId && (!district || district.city_id !== city.id)) {
    throw new BadRequestError("location.district_id is invalid for the selected city");
  }

  return {
    address_id: null,
    state,
    city: {
      id: city.id,
      code: city.code,
      name: city.name,
      normalized_name: city.normalized_name,
    },
    district: district
      ? {
          id: district.id,
          code: district.code,
          name: district.name,
          normalized_name: district.normalized_name,
        }
      : null,
  };
};

const syncGHNProvinces = async (context: SupportedProviderContext) => {
  const response = await context.client.address.getProvince();
  const items = (response.data ?? []) as NonNullable<GHNProvinceResponse["data"]>;
  const activeExternalIds: string[] = [];

  for (const item of items) {
    const externalId = String(item.ProvinceID);
    activeExternalIds.push(externalId);

    await prisma.shippingProviderProvince.upsert({
      where: {
        provider_id_external_id: {
          provider_id: context.provider.id,
          external_id: externalId,
        },
      },
      update: {
        code: item.Code?.trim() || null,
        name: item.ProvinceName,
        normalized_name: normalizeLocationText(item.ProvinceName),
        raw_payload: toJsonObject(item as unknown as Record<string, unknown>),
        is_active: item.Status === undefined ? true : item.Status !== 0,
      },
      create: {
        provider_id: context.provider.id,
        external_id: externalId,
        code: item.Code?.trim() || null,
        name: item.ProvinceName,
        normalized_name: normalizeLocationText(item.ProvinceName),
        raw_payload: toJsonObject(item as unknown as Record<string, unknown>),
        is_active: item.Status === undefined ? true : item.Status !== 0,
      },
    });
  }

  if (activeExternalIds.length > 0) {
    await prisma.shippingProviderProvince.updateMany({
      where: {
        provider_id: context.provider.id,
        external_id: {
          notIn: activeExternalIds,
        },
      },
      data: {
        is_active: false,
      },
    });
  }

  await touchConnectionLastSync(context.provider.id, context.store_id);

  return prisma.shippingProviderProvince.findMany({
    where: {
      provider_id: context.provider.id,
      is_active: true,
    },
    orderBy: [{ name: "asc" }],
  });
};

const syncGHNDistricts = async (
  context: SupportedProviderContext,
  province: {
    id: number;
    external_id: string;
  },
) => {
  const response = await context.client.address.getDistrict({
    province_id: parseExternalPositiveInt(
      province.external_id,
      "provider province external_id",
    ),
  });
  const items = (response.data ?? []) as NonNullable<GHNDistrictResponse["data"]>;
  const activeExternalIds: string[] = [];

  for (const item of items) {
    const externalId = String(item.DistrictID);
    activeExternalIds.push(externalId);

    await prisma.shippingProviderDistrict.upsert({
      where: {
        provider_id_external_id: {
          provider_id: context.provider.id,
          external_id: externalId,
        },
      },
      update: {
        province_id: province.id,
        code: item.Code?.trim() || null,
        name: item.DistrictName,
        normalized_name: normalizeLocationText(item.DistrictName),
        raw_payload: toJsonObject(item as unknown as Record<string, unknown>),
        is_active: item.Status === undefined ? true : item.Status !== 0,
      },
      create: {
        provider_id: context.provider.id,
        province_id: province.id,
        external_id: externalId,
        code: item.Code?.trim() || null,
        name: item.DistrictName,
        normalized_name: normalizeLocationText(item.DistrictName),
        raw_payload: toJsonObject(item as unknown as Record<string, unknown>),
        is_active: item.Status === undefined ? true : item.Status !== 0,
      },
    });
  }

  if (activeExternalIds.length > 0) {
    await prisma.shippingProviderDistrict.updateMany({
      where: {
        provider_id: context.provider.id,
        province_id: province.id,
        external_id: {
          notIn: activeExternalIds,
        },
      },
      data: {
        is_active: false,
      },
    });
  }

  await touchConnectionLastSync(context.provider.id, context.store_id);

  return prisma.shippingProviderDistrict.findMany({
    where: {
      provider_id: context.provider.id,
      province_id: province.id,
      is_active: true,
    },
    orderBy: [{ name: "asc" }],
  });
};

const syncGHNWards = async (
  context: SupportedProviderContext,
  providerDistrict: {
    id: number;
    external_id: string;
  },
) => {
  const response = await context.client.address.getWard({
    district_id: parseExternalPositiveInt(
      providerDistrict.external_id,
      "provider district external_id",
    ),
  });
  const items = (response.data ?? []) as NonNullable<GHNWardResponse["data"]>;
  const activeExternalIds: string[] = [];

  for (const item of items) {
    const externalId = String(item.WardCode);
    activeExternalIds.push(externalId);

    await prisma.shippingProviderWard.upsert({
      where: {
        provider_id_external_id: {
          provider_id: context.provider.id,
          external_id: externalId,
        },
      },
      update: {
        provider_district_id: providerDistrict.id,
        code: item.WardCode?.trim() || null,
        name: item.WardName,
        normalized_name: normalizeLocationText(item.WardName),
        raw_payload: toJsonObject(item as unknown as Record<string, unknown>),
        is_active: item.Status === undefined ? true : item.Status !== 0,
      },
      create: {
        provider_id: context.provider.id,
        provider_district_id: providerDistrict.id,
        external_id: externalId,
        code: item.WardCode?.trim() || null,
        name: item.WardName,
        normalized_name: normalizeLocationText(item.WardName),
        raw_payload: toJsonObject(item as unknown as Record<string, unknown>),
        is_active: item.Status === undefined ? true : item.Status !== 0,
      },
    });
  }

  if (activeExternalIds.length > 0) {
    await prisma.shippingProviderWard.updateMany({
      where: {
        provider_id: context.provider.id,
        provider_district_id: providerDistrict.id,
        external_id: {
          notIn: activeExternalIds,
        },
      },
      data: {
        is_active: false,
      },
    });
  }

  await touchConnectionLastSync(context.provider.id, context.store_id);

  return prisma.shippingProviderWard.findMany({
    where: {
      provider_id: context.provider.id,
      provider_district_id: providerDistrict.id,
      is_active: true,
    },
    orderBy: [{ name: "asc" }],
  });
};

const ensureProviderProvinces = async (context: SupportedProviderContext) => {
  const existing = await prisma.shippingProviderProvince.findMany({
    where: {
      provider_id: context.provider.id,
      is_active: true,
    },
    orderBy: [{ name: "asc" }],
  });

  if (existing.length > 0) {
    return existing;
  }

  return syncGHNProvinces(context);
};

const ensureProviderDistricts = async (
  context: SupportedProviderContext,
  province: {
    id: number;
    external_id: string;
  },
) => {
  const existing = await prisma.shippingProviderDistrict.findMany({
    where: {
      provider_id: context.provider.id,
      province_id: province.id,
      is_active: true,
    },
    orderBy: [{ name: "asc" }],
  });

  if (existing.length > 0) {
    return existing;
  }

  return syncGHNDistricts(context, province);
};

const ensureProviderWards = async (
  context: SupportedProviderContext,
  providerDistrict: {
    id: number;
    external_id: string;
  },
) => {
  const existing = await prisma.shippingProviderWard.findMany({
    where: {
      provider_id: context.provider.id,
      provider_district_id: providerDistrict.id,
      is_active: true,
    },
    orderBy: [{ name: "asc" }],
  });

  if (existing.length > 0) {
    return existing;
  }

  return syncGHNWards(context, providerDistrict);
};

const ensureStateMapping = async (
  context: SupportedProviderContext,
  state: InternalLocationRecord["state"],
) => {
  const existing = await prisma.shippingProviderStateMapping.findUnique({
    where: {
      provider_id_state_id: {
        provider_id: context.provider.id,
        state_id: state.id,
      },
    },
    include: {
      provider_province: true,
    },
  });

  if (existing) {
    return existing;
  }

  const provinces = await ensureProviderProvinces(context);
  const match = pickBestLocationCandidate(state, provinces, "province");

  if (!match) {
    throw new BadRequestError(
      `Cannot map state "${state.name}" to ${context.provider.display_name}`,
    );
  }

  return prisma.shippingProviderStateMapping.upsert({
    where: {
      provider_id_state_id: {
        provider_id: context.provider.id,
        state_id: state.id,
      },
    },
    update: {
      provider_province_id: match.candidate.id,
      source: "auto",
      confidence_score: match.score,
    },
    create: {
      provider_id: context.provider.id,
      state_id: state.id,
      provider_province_id: match.candidate.id,
      source: "auto",
      confidence_score: match.score,
    },
    include: {
      provider_province: true,
    },
  });
};

const ensureCityMapping = async (
  context: SupportedProviderContext,
  city: InternalLocationRecord["city"],
  stateMapping: {
    provider_province: {
      id: number;
      external_id: string;
    };
  },
) => {
  const existing = await prisma.shippingProviderCityMapping.findUnique({
    where: {
      provider_id_city_id: {
        provider_id: context.provider.id,
        city_id: city.id,
      },
    },
    include: {
      provider_district: true,
    },
  });

  if (existing) {
    return existing;
  }

  const providerDistricts = await ensureProviderDistricts(
    context,
    stateMapping.provider_province,
  );
  const match = pickBestLocationCandidate(city, providerDistricts, "district");

  if (!match) {
    throw new BadRequestError(
      `Cannot map city "${city.name}" to ${context.provider.display_name}`,
    );
  }

  return prisma.shippingProviderCityMapping.upsert({
    where: {
      provider_id_city_id: {
        provider_id: context.provider.id,
        city_id: city.id,
      },
    },
    update: {
      provider_district_id: match.candidate.id,
      source: "auto",
      confidence_score: match.score,
    },
    create: {
      provider_id: context.provider.id,
      city_id: city.id,
      provider_district_id: match.candidate.id,
      source: "auto",
      confidence_score: match.score,
    },
    include: {
      provider_district: true,
    },
  });
};

const ensureDistrictMapping = async (
  context: SupportedProviderContext,
  district: NonNullable<InternalLocationRecord["district"]>,
  cityMapping: {
    provider_district: {
      id: number;
      external_id: string;
    };
  },
) => {
  const existing = await prisma.shippingProviderDistrictMapping.findUnique({
    where: {
      provider_id_district_id: {
        provider_id: context.provider.id,
        district_id: district.id,
      },
    },
    include: {
      provider_ward: true,
    },
  });

  if (existing) {
    return existing;
  }

  const providerWards = await ensureProviderWards(context, cityMapping.provider_district);
  const match = pickBestLocationCandidate(district, providerWards, "ward");

  if (!match) {
    throw new BadRequestError(
      `Cannot map district "${district.name}" to ${context.provider.display_name}`,
    );
  }

  return prisma.shippingProviderDistrictMapping.upsert({
    where: {
      provider_id_district_id: {
        provider_id: context.provider.id,
        district_id: district.id,
      },
    },
    update: {
      provider_ward_id: match.candidate.id,
      source: "auto",
      confidence_score: match.score,
    },
    create: {
      provider_id: context.provider.id,
      district_id: district.id,
      provider_ward_id: match.candidate.id,
      source: "auto",
      confidence_score: match.score,
    },
    include: {
      provider_ward: true,
    },
  });
};

export const resolveProviderLocationFromCanonical = async (
  context: SupportedProviderContext,
  input: ShippingCanonicalLocationInput | null | undefined,
  options?: {
    require_district?: boolean;
  },
): Promise<ShippingResolvedLocation> => {
  const internalLocation = await readCanonicalLocation(input);

  if (options?.require_district && !internalLocation.district) {
    throw new BadRequestError(
      "location.district_id is required to calculate shipping fee",
    );
  }

  const stateMapping = await ensureStateMapping(context, internalLocation.state);
  const cityMapping = await ensureCityMapping(
    context,
    internalLocation.city,
    stateMapping,
  );
  const districtMapping = internalLocation.district
    ? await ensureDistrictMapping(context, internalLocation.district, cityMapping)
    : null;

  return {
    address_id: internalLocation.address_id,
    state: internalLocation.state,
    city: internalLocation.city,
    district: internalLocation.district,
    provider_province: {
      id: stateMapping.provider_province.id,
      external_id: stateMapping.provider_province.external_id,
      code: stateMapping.provider_province.code,
      name: stateMapping.provider_province.name,
    },
    provider_district: {
      id: cityMapping.provider_district.id,
      external_id: cityMapping.provider_district.external_id,
      code: cityMapping.provider_district.code,
      name: cityMapping.provider_district.name,
    },
    provider_ward: districtMapping
      ? {
          id: districtMapping.provider_ward.id,
          external_id: districtMapping.provider_ward.external_id,
          code: districtMapping.provider_ward.code,
          name: districtMapping.provider_ward.name,
        }
      : null,
    mapping_source: {
      state: stateMapping.source,
      city: cityMapping.source,
      district: districtMapping?.source ?? null,
    },
  };
};

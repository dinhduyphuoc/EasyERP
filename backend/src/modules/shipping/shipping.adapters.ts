import { BadRequestError, NotFoundError } from "@/common";

export type ShippingCredentialField = {
  key: string;
  label: string;
  placeholder?: string;
  input_type: "text" | "password" | "number";
  required: boolean;
  min_length?: number;
  helper_text?: string;
};

export type ShippingProviderDefinition = {
  code: string;
  display_name: string;
  short_description: string;
  logo_url: string | null;
  credential_fields: ShippingCredentialField[];
  capabilities: {
    verify_connection: boolean;
    warehouse_mapping: boolean;
    create_shipment: boolean;
    tracking: boolean;
    webhook: boolean;
  };
};

export type ShippingVerificationResult = {
  success: boolean;
  message: string;
  metadata?: Record<string, unknown>;
};

export interface ShippingProviderAdapter {
  readonly definition: ShippingProviderDefinition;
  validateCredentials(credentials: Record<string, unknown>): Record<string, string>;
  maskCredentials(credentials: Record<string, unknown> | null | undefined): Record<string, string>;
  verifyConnection(input: {
    credentials: Record<string, string>;
    metadata: Record<string, unknown>;
  }): Promise<ShippingVerificationResult>;
}

const ensureStringCredential = (
  credentials: Record<string, unknown>,
  field: ShippingCredentialField,
) => {
  const rawValue = credentials[field.key];

  if (typeof rawValue !== "string") {
    throw new BadRequestError(`${field.label} is required`);
  }

  const trimmed = rawValue.trim();

  if (field.required && trimmed.length === 0) {
    throw new BadRequestError(`${field.label} is required`);
  }

  if (field.input_type === "number" && !/^\d+$/.test(trimmed)) {
    throw new BadRequestError(`${field.label} must contain digits only`);
  }

  if (trimmed.length < (field.min_length ?? 1)) {
    throw new BadRequestError(
      `${field.label} must be at least ${field.min_length ?? 1} characters`,
    );
  }

  return trimmed;
};

const maskValue = (value: string) => {
  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}****${value.slice(-4)}`;
};

abstract class BaseTokenShippingAdapter implements ShippingProviderAdapter {
  abstract readonly definition: ShippingProviderDefinition;

  validateCredentials(credentials: Record<string, unknown>) {
    const next: Record<string, string> = {};

    for (const field of this.definition.credential_fields) {
      next[field.key] = ensureStringCredential(credentials, field);
    }

    return next;
  }

  maskCredentials(credentials: Record<string, unknown> | null | undefined) {
    if (!credentials) {
      return {};
    }

    const next: Record<string, string> = {};

    for (const field of this.definition.credential_fields) {
      const value = credentials[field.key];

      if (typeof value === "string" && value.trim()) {
        next[field.key] = maskValue(value.trim());
      }
    }

    return next;
  }

  async verifyConnection(input: {
    credentials: Record<string, string>;
    metadata: Record<string, unknown>;
  }): Promise<ShippingVerificationResult> {
    const token = input.credentials.token ?? "";

    if (token.length < 10) {
      return {
        success: false,
        message: "Token is not valid for verification.",
      };
    }

    return {
      success: true,
      message: `Local verification passed for ${this.definition.display_name}. Remote API verification can be attached in this adapter later.`,
      metadata: {
        verification_mode: "local_stub",
        token_preview: maskValue(token),
      },
    };
  }
}

class GhnShippingAdapter extends BaseTokenShippingAdapter {
  readonly definition: ShippingProviderDefinition = {
    code: "ghn",
    display_name: "GHN",
    short_description:
      "Ket noi Giao Hang Nhanh de chuan bi cho luong tao van don, tracking va webhook theo tung cua hang.",
    logo_url: null,
    credential_fields: [
      {
        key: "shop_id",
        label: "Shop ID",
        placeholder: "Nhap Shop ID GHN",
        input_type: "text",
        required: true,
        min_length: 1,
        helper_text: "Shop ID dung cho cac request tao va cap nhat van don GHN.",
      },
      {
        key: "token",
        label: "Client Token",
        placeholder: "Nhap client token GHN",
        input_type: "password",
        required: true,
        min_length: 10,
        helper_text: "Token dung de dong bo cau hinh va xac thuc ket noi GHN cho tung store.",
      },
    ],
    capabilities: {
      verify_connection: true,
      warehouse_mapping: true,
      create_shipment: true,
      tracking: true,
      webhook: true,
    },
  };
}

class GhtkShippingAdapter extends BaseTokenShippingAdapter {
  readonly definition: ShippingProviderDefinition = {
    code: "ghtk",
    display_name: "GHTK",
    short_description:
      "Ket noi Giao Hang Tiet Kiem de quan ly token tich hop, lam nen cho tao van don va dong bo trang thai giao hang.",
    logo_url: null,
    credential_fields: [
      {
        key: "token",
        label: "Client Token",
        placeholder: "Nhap client token GHTK",
        input_type: "password",
        required: true,
        min_length: 10,
        helper_text: "Token dung de dong bo va xac thuc ket noi GHTK cho tung store.",
      },
    ],
    capabilities: {
      verify_connection: true,
      warehouse_mapping: true,
      create_shipment: true,
      tracking: true,
      webhook: true,
    },
  };
}

const adapters = [new GhnShippingAdapter(), new GhtkShippingAdapter()];

export const shippingProviderAdapters = adapters;

export const resolveShippingAdapter = (providerCode: string) => {
  const adapter = adapters.find((item) => item.definition.code === providerCode.toLowerCase());

  if (!adapter) {
    throw new NotFoundError("Shipping provider is not supported");
  }

  return adapter;
};

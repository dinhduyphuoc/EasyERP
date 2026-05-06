import { BadRequestError, NotFoundError } from "@/common";
import { createGHNClient } from "@/lib/ghn";

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
      "Kết nối Giao Hàng Nhanh để chuẩn bị cho luồng tạo vận đơn, tracking và webhook theo từng cửa hàng.",
    logo_url: null,
    credential_fields: [
      {
        key: "shop_id",
        label: "Shop ID",
        placeholder: "Nhập Shop ID GHN",
        input_type: "text",
        required: true,
        min_length: 1,
        helper_text: "Shop ID dùng cho các request tạo và cập nhật vận đơn GHN.",
      },
      {
        key: "token",
        label: "Client Token",
        placeholder: "Nhập client token GHN",
        input_type: "password",
        required: true,
        min_length: 10,
        helper_text: "Token dùng để đồng bộ cấu hình và xác thực kết nối GHN cho từng store.",
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

  override async verifyConnection(input: {
    credentials: Record<string, string>;
    metadata: Record<string, unknown>;
  }): Promise<ShippingVerificationResult> {
    const credentials = this.validateCredentials(input.credentials);
    const ghnClient = createGHNClient({
      token: credentials.token,
      shopId: credentials.shop_id,
    });

    try {
      const response = await ghnClient.store.getStore({
        limit: 100,
        offset: 0,
      });

      const shops = response.data?.shops ?? [];
      const numericShopId = Number(credentials.shop_id);
      const matchedShop = shops.find((shop: any) => shop._id === numericShopId);

      if (!matchedShop) {
        return {
          success: false,
          message: `Token GHN hợp lệ nhưng không truy cập được Shop ID ${credentials.shop_id}.`,
          metadata: {
            verification_mode: "remote_ghn_store_lookup",
            token_preview: maskValue(credentials.token),
            available_shop_ids: shops.slice(0, 10).map((shop: any) => shop._id),
          },
        };
      }

      return {
        success: true,
        message: `Kết nối GHN hợp lệ với shop ${matchedShop.name} (#${matchedShop._id}).`,
        metadata: {
          verification_mode: "remote_ghn_store_lookup",
          token_preview: maskValue(credentials.token),
          shop_id: matchedShop._id,
          shop_name: matchedShop.name,
          shop_phone: matchedShop.phone,
          shop_address: matchedShop.address,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể xác minh kết nối GHN.";
      return {
        success: false,
        message,
        metadata: {
          verification_mode: "remote_ghn_store_lookup",
          token_preview: maskValue(credentials.token),
        },
      };
    }
  }
}

class GhtkShippingAdapter extends BaseTokenShippingAdapter {
  readonly definition: ShippingProviderDefinition = {
    code: "ghtk",
    display_name: "GHTK",
    short_description:
      "Kết nối Giao Hàng Tiết Kiệm để quản lý token tích hợp, làm nền cho tạo vận đơn và đồng bộ trạng thái giao hàng.",
    logo_url: null,
    credential_fields: [
      {
        key: "token",
        label: "Client Token",
        placeholder: "Nhập client token GHTK",
        input_type: "password",
        required: true,
        min_length: 10,
        helper_text: "Token dùng để đồng bộ và xác thực kết nối GHTK cho từng store.",
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

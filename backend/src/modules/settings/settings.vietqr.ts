import { createRequire } from "node:module";
import { BadRequestError } from "@/common";
import type {
  VietQrBankItem,
  VietQrGenerateInput,
  VietQrGenerateResponse,
  VietQrTemplateItem,
} from "./settings.types";
import type { VietQR as VietQrCtor } from "vietqr";

type VietQrLibraryResponse<T> = {
  code: string;
  desc: string;
  data: T;
};

type VietQrGenerateLibraryResponse = {
  code: string;
  desc: string;
  data: {
    acqId: string;
    accountName: string;
    qrDataURL: string;
  };
};

type VietQrLibraryClient = {
  getBanks: () => Promise<VietQrLibraryResponse<VietQrBankItem[]>>;
  getTemplate: () => Promise<VietQrLibraryResponse<VietQrTemplateItem[]>>;
  genQuickLink: (input: {
    bank: string;
    accountName: string;
    accountNumber: string;
    amount: string;
    memo: string;
    template: string;
    media: string;
  }) => string;
  genQRCodeBase64: (input: {
    bank: string;
    accountName: string;
    accountNumber: string;
    amount: string;
    memo: string;
    template: string;
  }) => Promise<{ data?: VietQrGenerateLibraryResponse } | VietQrGenerateLibraryResponse>;
};

const DEFAULT_QR_TEMPLATE = "compact";
const DEFAULT_QR_MEDIA = ".png";
const DEFAULT_TEMPLATE_RESPONSE: VietQrLibraryResponse<VietQrTemplateItem[]> = {
  code: "00",
  desc: "success",
  data: [
    {
      name: "QR Only",
      template: "qr_only",
      demo: "",
    },
    {
      name: "Compact",
      template: "compact",
      demo: "",
    },
    {
      name: "Compact 2",
      template: "compact2",
      demo: "",
    },
    {
      name: "Print",
      template: "print",
      demo: "",
    },
  ],
};
const require = createRequire(import.meta.url);

let cachedClient: VietQrLibraryClient | null = null;

const toTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const toAmountString = (value: unknown): string => {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestError("amount must be a non-negative number");
    }

    return Math.trunc(value).toString();
  }

  const normalized = toTrimmedString(value);

  if (!normalized) {
    return "";
  }

  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestError("amount must contain digits only");
  }

  return normalized;
};

const getConfiguredClient = async () => {
  if (cachedClient) {
    return cachedClient;
  }

  const clientID = process.env.VIETQR_CLIENT_ID?.trim();
  const apiKey = process.env.VIETQR_API_KEY?.trim();

  if (!clientID || !apiKey) {
    throw new BadRequestError("VietQR configuration is missing");
  }

  const { VietQR } = require("vietqr") as { VietQR: typeof VietQrCtor };
  cachedClient = new VietQR({
    clientID,
    apiKey,
  });

  return cachedClient;
};

const unwrapResponse = <T>(result: { data?: T } | T): T => {
  if (result && typeof result === "object" && "data" in result && result.data) {
    return result.data;
  }

  return result as T;
};

export const VietQrService = {
  getBanks: async () => {
    const client = await getConfiguredClient();
    const response = await client.getBanks();
    return response;
  },

  getTemplates: async () => {
    const client = await getConfiguredClient();
    const response = await client.getTemplate();
    const status =
      response &&
      typeof response === "object" &&
      "response" in response &&
      response.response &&
      typeof response.response === "object"
        ? (response.response as { status?: number }).status
        : undefined;

    if (status === 404) {
      return DEFAULT_TEMPLATE_RESPONSE;
    }

    return response as VietQrLibraryResponse<VietQrTemplateItem[]>;
  },

  generateQr: async (
    input: VietQrGenerateInput,
    defaults: {
      bank_name: string;
      bank_bin: string;
      bank_code: string;
      account_number: string;
      account_holder: string;
      qr_template: string;
    },
  ): Promise<VietQrGenerateResponse> => {
    const client = await getConfiguredClient();
    const bankBin = toTrimmedString(input.bank_bin) || defaults.bank_bin;
    const accountName = toTrimmedString(input.account_name) || defaults.account_holder;
    const accountNumber = toTrimmedString(input.account_number) || defaults.account_number;
    const amount = toAmountString(input.amount);
    const memo = toTrimmedString(input.memo);
    const template = toTrimmedString(input.template) || defaults.qr_template || DEFAULT_QR_TEMPLATE;
    const media = toTrimmedString(input.media) || DEFAULT_QR_MEDIA;

    if (!bankBin) {
      throw new BadRequestError("bank_bin is required to generate VietQR");
    }

    if (!accountName) {
      throw new BadRequestError("account_name is required to generate VietQR");
    }

    if (!accountNumber) {
      throw new BadRequestError("account_number is required to generate VietQR");
    }

    const rawResponse = await client.genQRCodeBase64({
      bank: bankBin,
      accountName,
      accountNumber,
      amount,
      memo,
      template,
    });
    const response = unwrapResponse<VietQrGenerateLibraryResponse>(rawResponse);

    return {
      ...response,
      quick_link: client.genQuickLink({
        bank: bankBin,
        accountName,
        accountNumber,
        amount,
        memo,
        template,
        media,
      }),
    };
  },
};

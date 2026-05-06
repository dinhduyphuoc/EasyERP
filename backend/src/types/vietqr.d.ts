declare module "vietqr" {
  export type VietQrBankItem = {
    id: number;
    name: string;
    code: string;
    bin: string;
    isTransfer: number;
    short_name: string;
    logo: string;
    support: number;
  };

  export type VietQrTemplateItem = {
    name: string;
    template: string;
    demo: string;
  };

  export type VietQrGeneratePayload = {
    bank: string;
    accountName: string;
    accountNumber: string;
    amount: string;
    memo: string;
    template: string;
  };

  export type VietQrGenerateResponse = {
    code: string;
    desc: string;
    data: {
      acqId: string;
      accountName: string;
      qrDataURL: string;
    };
  };

  export class VietQR {
    constructor(config: { clientID: string; apiKey: string });
    getBanks(): Promise<{ code: string; desc: string; data: VietQrBankItem[] }>;
    getTemplate(): Promise<{ code: string; desc: string; data: VietQrTemplateItem[] }>;
    genQuickLink(input: VietQrGeneratePayload & { media: string }): string;
    genQRCodeBase64(
      input: VietQrGeneratePayload,
    ): Promise<{ data?: VietQrGenerateResponse } | VietQrGenerateResponse>;
  }
}

export type ShippingStoreScopedQuery = {
  store_id?: string;
};

export type ShippingProviderParams = {
  code: string;
};

export type ShippingConnectInput = {
  store_id?: string;
  credentials?: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  verify?: boolean;
  actor?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

export type ShippingDisconnectInput = {
  store_id?: string;
  actor?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

export type ShippingVerifyInput = {
  store_id?: string;
  credentials?: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
};

export type GHNWebhookOrderFee = {
  CODFailedFee?: number;
  CODFee?: number;
  Coupon?: number;
  DeliverRemoteAreasFee?: number;
  DocumentReturn?: number;
  DoubleCheck?: number;
  Insurance?: number;
  MainService?: number;
  PickRemoteAreasFee?: number;
  R2S?: number;
  Return?: number;
  StationDO?: number;
  StationPU?: number;
  Total?: number;
};

export type GHNOrderStatusCallbackPayload = {
  CODAmount?: number;
  CODTransferDate?: string | null;
  ClientOrderCode?: string;
  ConvertedWeight?: number;
  Description?: string;
  Fee?: GHNWebhookOrderFee;
  Height?: number;
  IsPartialReturn?: boolean;
  Length?: number;
  OrderCode?: string;
  PartialReturnCode?: string;
  PaymentType?: number;
  Reason?: string;
  ReasonCode?: string;
  ShopID?: number;
  Status?: string;
  Time?: string;
  TotalFee?: number;
  Type?: string;
  Warehouse?: string;
  Weight?: number;
  Width?: number;
};

export type GHNTicketConversationPayload = {
  Attachments?: unknown[];
  BccEmails?: string[] | null;
  Body?: string;
  CcEmails?: string[] | null;
  CreatedAt?: string;
  FromEmail?: string;
  Private?: boolean;
  UpdatedAt?: string;
  UserId?: number;
};

export type GHNTicketCallbackPayload = {
  A_Email?: string;
  Attachments?: unknown[];
  C_Email?: string;
  C_Name?: string;
  C_Phone?: string;
  ClientID?: string;
  Conversations?: GHNTicketConversationPayload[];
  CreatedBy?: number;
  CreatedAt?: string;
  Description?: string;
  OrderCode?: string;
  Status?: string;
  StatusID?: number;
  TicketId?: number;
  Type?: string;
  UpdatedAt?: string;
};

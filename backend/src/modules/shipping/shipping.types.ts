export type ShippingProviderParams = {
  code: string;
};

export type ShippingProviderAddressProvince = {
  id: number;
  code: string;
  name: string;
};

export type ShippingProviderAddressDistrict = {
  id: number;
  province_id: number;
  code: string;
  name: string;
};

export type ShippingProviderAddressWard = {
  code: string;
  district_id: number;
  name: string;
};

export type ShippingAddressDistrictQuery = {
  province_id?: string;
};

export type ShippingAddressWardQuery = {
  district_id?: string;
};

export type ShippingAvailableServicesInput = {
  from_district_id?: number | string | null;
  to_district_id?: number | string | null;
};

export type ShippingCanonicalLocationInput = {
  address_id?: number | string | null;
  state_id?: number | string | null;
  city_id?: number | string | null;
  district_id?: number | string | null;
};

export type ShippingResolvedLocation = {
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
  provider_province: {
    id: number;
    external_id: string;
    code: string | null;
    name: string;
  };
  provider_district: {
    id: number;
    external_id: string;
    code: string | null;
    name: string;
  };
  provider_ward: {
    id: number;
    external_id: string;
    code: string | null;
    name: string;
  } | null;
  mapping_source: {
    state: string;
    city: string;
    district: string | null;
  };
};

export type ShippingLocationResolveInput = {
  location?: ShippingCanonicalLocationInput | null;
};

export type ShippingAvailableServicesByLocationInput = {
  from_location?: ShippingCanonicalLocationInput | null;
  to_location?: ShippingCanonicalLocationInput | null;
};

export type ShippingFeeQuoteInput = {
  from_district_id?: number | string | null;
  from_ward_code?: string | null;
  to_district_id?: number | string | null;
  to_ward_code?: string | null;
  service_id?: number | string | null;
  service_type_id?: number | string | null;
  weight?: number | string | null;
  length?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  insurance_value?: number | string | null;
  cod_value?: number | string | null;
  coupon?: string | null;
  items?: Array<{
    name?: string;
    quantity?: number | string;
    height?: number | string | null;
    weight?: number | string | null;
    length?: number | string | null;
    width?: number | string | null;
  }>;
};

export type ShippingFeeQuoteByLocationInput = {
  from_location?: ShippingCanonicalLocationInput | null;
  to_location?: ShippingCanonicalLocationInput | null;
  service_id?: number | string | null;
  service_type_id?: number | string | null;
  weight?: number | string | null;
  length?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  insurance_value?: number | string | null;
  cod_value?: number | string | null;
  coupon?: string | null;
  items?: Array<{
    name?: string;
    quantity?: number | string;
    height?: number | string | null;
    weight?: number | string | null;
    length?: number | string | null;
    width?: number | string | null;
  }>;
};

export type ShippingConnectInput = {
  credentials?: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  verify?: boolean;
  actor?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

export type ShippingDisconnectInput = {
  actor?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

export type ShippingVerifyInput = {
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

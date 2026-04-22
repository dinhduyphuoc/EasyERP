import type {
  ShippingAddressAPI,
  ShippingFeeAPI,
  ShippingOrderAPI,
  ShippingProviderConfig,
  ShippingProviderStrategy,
  ShippingRequestOptions,
  ShippingStoreAPI,
  ShippingTicketAPI,
  ShippingTransport,
  ShippingWebhookAPI,
} from "../shipping";

export type GHNRequestOptions<TInput = unknown> = ShippingRequestOptions<TInput>;

export interface GHNTransport extends ShippingTransport {}

export type GHNClientConfig = ShippingProviderConfig;

export type GHNItemCategory = {
  level1?: string;
  level2?: string;
  level3?: string;
};

export type GHNOrderItemInput = {
  name: string;
  code?: string;
  quantity: number;
  price?: number;
  length?: number;
  width?: number;
  height?: number;
  weight: number;
  category?: GHNItemCategory;
};

export type GHNCreateOrderInput = {
  payment_type_id: number;
  required_note: "CHOTHUHANG" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG";
  to_name: string;
  to_phone: string;
  to_address: string;
  to_ward_code: string;
  to_district_id: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  service_type_id: number;
  items: GHNOrderItemInput[];
  note?: string;
  from_name?: string;
  from_phone?: string;
  from_address?: string;
  from_ward_name?: string;
  from_district_name?: string;
  from_province_name?: string;
  return_phone?: string;
  return_address?: string;
  return_district_id?: number | null;
  return_ward_code?: string;
  client_order_code?: string | null;
  cod_amount?: number;
  content?: string;
  pick_station_id?: number;
  deliver_station_id?: number | null;
  insurance_value?: number;
  service_id?: number;
  coupon?: string | null;
  pick_shift?: number[];
};

export type GHNUpdateOrderInput = {
  order_code: string;
  note?: string;
  from_name?: string;
  from_phone?: string;
  from_address?: string;
  from_ward_code?: string;
  to_name?: string;
  to_phone?: string;
  to_address?: string;
  to_ward_code?: string;
  to_district_id?: number;
  return_phone?: string;
  return_address?: string;
  return_district_id?: number;
  return_ward_code?: string;
  client_order_code?: string | null;
  cod_amount?: number;
  content?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  pick_station_id?: number;
  insurance_value?: number;
  coupon?: string;
  payment_type_id?: 1 | 2;
  required_note?: "CHOTHUHANG" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG";
  pick_shift?: number[];
  items?: GHNOrderItemInput[];
};

export type GHNPrintOrderInput = {
  order_codes: string[];
};

export type GHNPrintTokenResponse = {
  code: number;
  message: string;
  data: {
    token: string;
  } | null;
};

export type GHNPrintOrderResponse = GHNPrintTokenResponse & {
  print_urls?: {
    a5: string;
    "80x80": string;
    "52x70": string;
  };
};

export type GHNFeeItemInput = {
  name: string;
  quantity: number;
  height?: number;
  weight?: number;
  length?: number;
  width?: number;
};

export type GHNCalculateFeeInput = {
  from_district_id?: number;
  from_ward_code?: string;
  service_id?: number | null;
  service_type_id?: number | null;
  to_district_id: number;
  to_ward_code: string;
  height?: number;
  length?: number;
  weight?: number;
  width?: number;
  insurance_value?: number;
  cod_failed_amount?: number;
  cod_value?: number;
  coupon?: string | null;
  items?: GHNFeeItemInput[];
};

export type GHNFeeCalculationResponse = {
  code: number;
  message: string;
  data: {
    total: number;
    service_fee: number;
    insurance_fee: number;
    pick_station_fee: number;
    coupon_value: number;
    r2s_fee: number;
    document_return: number;
    double_check: number;
    cod_fee: number;
    pick_remote_areas_fee: number;
    deliver_remote_areas_fee: number;
    cod_failed_fee: number;
  } | null;
};

export type GHNFeeByOrderInfoInput = {
  order_code: string;
};

export type GHNFeeByOrderInfoResponse = {
  code: number;
  message: string;
  data: {
    _id: string;
    order_code: string;
    detail: {
      main_service: number;
      insurance: number;
      station_do: number;
      station_pu: number;
      return: number;
      r2s: number;
      coupon: number;
    };
    payment: Array<{
      value: number;
      payment_type: number;
      paid_date: string;
      created_date: string;
    }>;
    cod_collect_date: string;
    transaction_id: string;
    created_ip: string;
    created_date: string;
    updated_ip: string;
    updated_client: number;
    updated_employee: number;
    updated_source: string;
    updated_date: string;
  } | null;
};

export type GHNAvailableServiceInput = {
  shop_id?: number;
  from_district: number;
  to_district: number;
};

export type GHNAvailableServiceResponse = {
  code: number;
  message: string;
  data: Array<{
    service_id: number;
    short_name: string;
    service_type_id: number;
  }> | null;
};

export type GHNGetStoreInput = {
  offset?: number;
  limit?: number;
  client_phone?: string;
};

export type GHNGetStoreResponse = {
  code: number;
  message: string;
  data: {
    last_offset: number;
    shops: Array<{
      _id: number;
      name: string;
      phone: string;
      address: string;
      ward_code: string;
      district_id: number;
      client_id: number;
      bank_account_id: number;
      status: number;
      version_no: string;
      updated_ip: string;
      updated_employee: number;
      updated_client: number;
      updated_source: string;
      updated_date: string | number;
      created_ip: string;
      created_employee: number;
      created_client: number;
      created_source: string;
      created_date: string;
    }>;
  } | null;
};

export type GHNCreateStoreInput = {
  district_id: number;
  ward_code: string;
  name: string;
  phone: string;
  address: string;
};

export type GHNCreateStoreResponse = {
  code: number;
  message: string;
  data: {
    shop_id: number;
  } | null;
};

export type GHNProvinceResponse = {
  code: number;
  message: string;
  data: Array<{
    ProvinceID: number;
    ProvinceName: string;
    Code: string;
    NameExtension?: string[];
    CreatedAt?: string;
    UpdatedAt?: string;
    CanUpdateCOD?: boolean;
    Status?: number;
  }> | null;
};

export type GHNDistrictInput = {
  province_id: number;
};

export type GHNDistrictResponse = {
  code: number;
  message: string;
  data: Array<{
    DistrictID: number;
    ProvinceID: number;
    DistrictName: string;
    Code: string;
    Type?: number;
    SupportType?: number;
    NameExtension?: string[];
    CanUpdateCOD?: boolean;
    Status?: number;
    CreatedDate?: string;
    UpdatedDate?: string;
  }> | null;
};

export type GHNWardInput = {
  district_id: number;
};

export type GHNWardResponse = {
  code: number;
  message: string;
  data: Array<{
    WardCode: string;
    DistrictID: number;
    WardName: string;
    NameExtension?: string[];
    CanUpdateCOD?: boolean;
    SupportType?: number;
    Status?: number;
    CreatedDate?: string;
    UpdatedDate?: string;
  }> | null;
};

export interface GHNOrderAPI extends ShippingOrderAPI {}

export interface GHNFeeAPI extends ShippingFeeAPI {}

export interface GHNStoreAPI extends ShippingStoreAPI {}

export interface GHNAddressAPI extends ShippingAddressAPI {}

export interface GHNWebhookAPI extends ShippingWebhookAPI {}

export interface GHNTicketAPI extends ShippingTicketAPI {}

export interface GHNClient extends ShippingProviderStrategy {}

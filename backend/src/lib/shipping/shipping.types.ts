export type ShippingHttpMethod = "GET" | "POST";

export type ShippingRequestOptions<TInput = unknown> = {
  method: ShippingHttpMethod;
  path: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  data?: TInput;
};

export interface ShippingTransport {
  request<TResponse = unknown, TInput = unknown>(
    options: ShippingRequestOptions<TInput>,
  ): Promise<TResponse>;
}

export type ShippingProviderConfig = {
  baseUrl?: string;
  token?: string;
  shopId?: number | string;
  transport?: ShippingTransport;
};

export type ShippingProviderCapability =
  | "order"
  | "fee"
  | "store"
  | "address"
  | "webhook"
  | "ticket";

export type ShippingProviderDefinition = {
  code: string;
  displayName: string;
  description: string;
  capabilities: ShippingProviderCapability[];
};

export interface ShippingOrderAPI {
  createOrder(input: any): Promise<any>;
  updateOrder(input: any): Promise<any>;
  cancelOrder(input: any): Promise<any>;
  returnOrder(input: any): Promise<any>;
  printOrder(input: any): Promise<any>;
  getOrderInfo(input: any): Promise<any>;
  getOrderInfoByClientOrderCode(input: any): Promise<any>;
  deliveryAgain(input: any): Promise<any>;
  updateCOD(input: any): Promise<any>;
  getStation(input: any): Promise<any>;
  calculateExpectedDeliveryTime(input: any): Promise<any>;
  pickShift(input: any): Promise<any>;
  previewOrder(input: any): Promise<any>;
}

export interface ShippingFeeAPI {
  calculateFee(input: any): Promise<any>;
  getFeeByOrderInfo(input: any): Promise<any>;
  getAvailableService(input: any): Promise<any>;
}

export interface ShippingStoreAPI {
  getStore(input?: any): Promise<any>;
  createStore(input: any): Promise<any>;
}

export interface ShippingAddressAPI {
  getProvince(): Promise<any>;
  getDistrict(input: any): Promise<any>;
  getWard(input: any): Promise<any>;
}

export interface ShippingWebhookAPI {
  registerOrderStatusCallback(input: any): Promise<any>;
  registerTicketCallback(input: any): Promise<any>;
}

export interface ShippingTicketAPI {
  createTicket(input: any): Promise<any>;
  createTicketFeedback(input: any): Promise<any>;
  getTicket(input: any): Promise<any>;
  getTicketList(input: any): Promise<any>;
}

export interface ShippingProviderStrategy {
  readonly definition: ShippingProviderDefinition;
  readonly order: ShippingOrderAPI;
  readonly fee: ShippingFeeAPI;
  readonly store: ShippingStoreAPI;
  readonly address: ShippingAddressAPI;
  readonly webhook: ShippingWebhookAPI;
  readonly ticket: ShippingTicketAPI;
}

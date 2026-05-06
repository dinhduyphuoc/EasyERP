import { GHNBaseAPI } from "./ghn.base";
import { buildGHNPrintUrls } from "./ghn.print";
import { GHN_ORDER_TRACKING_PUBLIC_API_BASE_URL } from "@/config";
import type {
  GHNClientConfig,
  GHNCreateOrderInput,
  GHNOrderAPI,
  GHNPrintOrderInput,
  GHNPrintOrderResponse,
  GHNTrackingLogsInput,
  GHNTrackingLogsResponse,
  GHNUpdateOrderInput,
} from "./ghn.types";

export class GHNOrderClient extends GHNBaseAPI implements GHNOrderAPI {
  constructor(config: GHNClientConfig) {
    super(config);
  }

  createOrder(input: GHNCreateOrderInput) {
    return this.request({ method: "POST", path: "shipping-order/create", data: input });
  }

  updateOrder(input: GHNUpdateOrderInput) {
    return this.request({ method: "POST", path: "shipping-order/update", data: input });
  }

  cancelOrder(input: any) {
    return this.request({ method: "POST", path: "switch-status/cancel", data: input });
  }

  returnOrder(input: any) {
    return this.request({ method: "POST", path: "switch-status/return", data: input });
  }

  async printOrder(input: GHNPrintOrderInput): Promise<GHNPrintOrderResponse> {
    const response = await this.request<GHNPrintOrderResponse, GHNPrintOrderInput>({
      method: "POST",
      path: "a5/gen-token",
      data: input,
    });

    const token = response.data?.token;

    if (!token) {
      return response;
    }

    return {
      ...response,
      print_urls: buildGHNPrintUrls(token, this.baseUrl),
    };
  }

  getOrderInfo(input: any) {
    return this.request({ method: "POST", path: "shipping-order/detail", data: input });
  }

  getOrderInfoByClientOrderCode(input: any) {
    return this.request({
      method: "POST",
      path: "shipping-order/detail-by-client-code",
      data: input,
    });
  }

  deliveryAgain(input: any) {
    return this.request({ method: "POST", path: "switch-status/storing", data: input });
  }

  updateCOD(input: any) {
    return this.request({ method: "POST", path: "shipping-order/updateCOD", data: input });
  }

  getStation(input: any) {
    return this.request({ method: "POST", path: "station/get", data: input });
  }

  calculateExpectedDeliveryTime(input: any) {
    return this.request({ method: "POST", path: "shipping-order/leadtime", data: input });
  }

  getTrackingLogs(input: GHNTrackingLogsInput): Promise<GHNTrackingLogsResponse> {
    return this.request<GHNTrackingLogsResponse, GHNTrackingLogsInput>({
      method: "POST",
      baseUrl: GHN_ORDER_TRACKING_PUBLIC_API_BASE_URL,
      path: "order-tracking/public-api/client/tracking-logs",
      data: input,
    });
  }

  pickShift(input: any) {
    return this.request({ method: "POST", path: "shift/date", data: input });
  }

  previewOrder(input: any) {
    return this.request({ method: "POST", path: "shipping-order/preview", data: input });
  }
}

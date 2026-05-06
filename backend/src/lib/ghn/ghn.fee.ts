import { GHNBaseAPI } from "./ghn.base";
import type {
  GHNAvailableServiceInput,
  GHNAvailableServiceResponse,
  GHNCalculateFeeInput,
  GHNClientConfig,
  GHNFeeAPI,
  GHNFeeByOrderInfoInput,
  GHNFeeByOrderInfoResponse,
  GHNFeeCalculationResponse,
} from "./ghn.types";

export class GHNFeeClient extends GHNBaseAPI implements GHNFeeAPI {
  constructor(config: GHNClientConfig) {
    super(config);
  }

  calculateFee(input: GHNCalculateFeeInput) {
    return this.request<GHNFeeCalculationResponse, GHNCalculateFeeInput>({
      method: "POST",
      path: "shipping-order/fee",
      data: input,
    });
  }

  getFeeByOrderInfo(input: GHNFeeByOrderInfoInput) {
    return this.request<GHNFeeByOrderInfoResponse, GHNFeeByOrderInfoInput>({
      method: "POST",
      path: "shipping-order/soc",
      data: input,
    });
  }

  getAvailableService(input: GHNAvailableServiceInput) {
    return this.request<GHNAvailableServiceResponse, GHNAvailableServiceInput>({
      method: "POST",
      path: "shipping-order/available-services",
      data: input,
    });
  }
}

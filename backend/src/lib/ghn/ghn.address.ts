import { GHNBaseAPI } from "./ghn.base";
import type {
  GHNAddressAPI,
  GHNClientConfig,
  GHNDistrictInput,
  GHNDistrictResponse,
  GHNProvinceResponse,
  GHNWardInput,
  GHNWardResponse,
} from "./ghn.types";

export class GHNAddressClient extends GHNBaseAPI implements GHNAddressAPI {
  constructor(config: GHNClientConfig) {
    super(config);
  }

  getProvince() {
    return this.request<GHNProvinceResponse>({
      method: "GET",
      baseUrl: "https://online-gateway.ghn.vn/shiip/public-api/",
      path: "master-data/province",
    });
  }

  getDistrict(input: GHNDistrictInput) {
    return this.request<GHNDistrictResponse, GHNDistrictInput>({
      method: "POST",
      baseUrl: "https://online-gateway.ghn.vn/shiip/public-api/",
      path: "master-data/district",
      data: input,
    });
  }

  getWard(input: GHNWardInput) {
    return this.request<GHNWardResponse, GHNWardInput>({
      method: "POST",
      baseUrl: "https://online-gateway.ghn.vn/shiip/public-api/",
      path: "master-data/ward",
      data: input,
    });
  }
}

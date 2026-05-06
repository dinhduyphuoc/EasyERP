import { GHNBaseAPI } from "./ghn.base";
import type {
  GHNClientConfig,
  GHNCreateStoreInput,
  GHNCreateStoreResponse,
  GHNGetStoreInput,
  GHNGetStoreResponse,
  GHNStoreAPI,
} from "./ghn.types";

export class GHNStoreClient extends GHNBaseAPI implements GHNStoreAPI {
  constructor(config: GHNClientConfig) {
    super(config);
  }

  getStore(input: GHNGetStoreInput = {}) {
    return this.request<GHNGetStoreResponse, GHNGetStoreInput>({
      method: "POST",
      path: "shop/all",
      data: input,
    });
  }

  createStore(input: GHNCreateStoreInput) {
    return this.request<GHNCreateStoreResponse, GHNCreateStoreInput>({
      method: "POST",
      path: "shop/register",
      data: input,
    });
  }
}

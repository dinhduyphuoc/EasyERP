import { GHNBaseAPI } from "./ghn.base";
import type { GHNClientConfig, GHNWebhookAPI } from "./ghn.types";

export class GHNWebhookClient extends GHNBaseAPI implements GHNWebhookAPI {
  constructor(config: GHNClientConfig) {
    super(config);
  }

  registerOrderStatusCallback(input: any) {
    return this.request({ method: "POST", path: "webhook/order-status", data: input });
  }

  registerTicketCallback(input: any) {
    return this.request({ method: "POST", path: "webhook/ticket", data: input });
  }
}

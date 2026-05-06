import { GHNBaseAPI } from "./ghn.base";
import type { GHNClientConfig, GHNTicketAPI } from "./ghn.types";

export class GHNTicketClient extends GHNBaseAPI implements GHNTicketAPI {
  constructor(config: GHNClientConfig) {
    super(config);
  }

  createTicket(input: any) {
    return this.request({ method: "POST", path: "ticket/create", data: input });
  }

  createTicketFeedback(input: any) {
    return this.request({ method: "POST", path: "ticket/feedback", data: input });
  }

  getTicket(input: any) {
    return this.request({ method: "POST", path: "ticket/detail", data: input });
  }

  getTicketList(input: any) {
    return this.request({ method: "POST", path: "ticket/list", data: input });
  }
}

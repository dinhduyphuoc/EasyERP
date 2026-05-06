import { GHNAddressClient } from "./ghn.address";
import { GHNFeeClient } from "./ghn.fee";
import { GHNOrderClient } from "./ghn.order";
import { GHNStoreClient } from "./ghn.store";
import { GHNTicketClient } from "./ghn.ticket";
import { createGHNTransport } from "./ghn.transport";
import { GHNWebhookClient } from "./ghn.webhook";
import { GHN_V2_API_BASE_URL } from "@/config";
import type { GHNClient, GHNClientConfig } from "./ghn.types";

export const createGHNClient = (config: GHNClientConfig): GHNClient => {
  const nextConfig: GHNClientConfig = {
    ...config,
    baseUrl: config.baseUrl ?? GHN_V2_API_BASE_URL,
    transport: config.transport ?? createGHNTransport(config),
  };

  return {
    definition: {
      code: "ghn",
      displayName: "GHN",
      description: "GHN shipping provider strategy",
      capabilities: ["order", "fee", "store", "address", "webhook", "ticket"],
    },
    order: new GHNOrderClient(nextConfig),
    fee: new GHNFeeClient(nextConfig),
    store: new GHNStoreClient(nextConfig),
    address: new GHNAddressClient(nextConfig),
    webhook: new GHNWebhookClient(nextConfig),
    ticket: new GHNTicketClient(nextConfig),
  };
};

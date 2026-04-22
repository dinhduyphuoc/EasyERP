import type { Request, Response } from "express";
import { BadRequestError } from "@/common";
import { ShippingService } from "./shipping.service";
import type {
  GHNOrderStatusCallbackPayload,
  GHNTicketCallbackPayload,
  ShippingConnectInput,
  ShippingDisconnectInput,
  ShippingProviderParams,
  ShippingStoreScopedQuery,
  ShippingVerifyInput,
} from "./shipping.types";

const parseBody = <T>(value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("Request body is required");
  }

  return value as T;
};

export const ShippingController = {
  listProviders: async (
    req: Request<{}, {}, {}, ShippingStoreScopedQuery>,
    res: Response,
  ) => {
    const data = await ShippingService.listProviders(req.query.store_id);
    return res.status(200).json(data);
  },

  getConnectionDetail: async (
    req: Request<ShippingProviderParams, {}, {}, ShippingStoreScopedQuery>,
    res: Response,
  ) => {
    const data = await ShippingService.getConnectionDetail(
      req.params.code,
      req.query.store_id,
    );
    return res.status(200).json(data);
  },

  connectProvider: async (
    req: Request<ShippingProviderParams, {}, ShippingConnectInput>,
    res: Response,
  ) => {
    const data = await ShippingService.connectProvider(
      req.params.code,
      parseBody<ShippingConnectInput>(req.body),
    );
    return res.status(200).json(data);
  },

  disconnectProvider: async (
    req: Request<ShippingProviderParams, {}, ShippingDisconnectInput>,
    res: Response,
  ) => {
    const data = await ShippingService.disconnectProvider(
      req.params.code,
      parseBody<ShippingDisconnectInput>(req.body),
    );
    return res.status(200).json(data);
  },

  verifyProvider: async (
    req: Request<ShippingProviderParams, {}, ShippingVerifyInput>,
    res: Response,
  ) => {
    const data = await ShippingService.verifyProvider(
      req.params.code,
      parseBody<ShippingVerifyInput>(req.body),
    );
    return res.status(200).json(data);
  },

  receiveGHNOrderStatusCallback: async (
    req: Request<{}, {}, GHNOrderStatusCallbackPayload>,
    res: Response,
  ) => {
    try {
      await ShippingService.receiveGHNOrderStatusCallback(
        parseBody<GHNOrderStatusCallbackPayload>(req.body),
      );
    } catch (error) {
      console.error("GHN order status callback processing failed:", error);
    }

    return res.status(200).json({ code: 200, message: "Success" });
  },

  receiveGHNTicketCallback: async (
    req: Request<{}, {}, GHNTicketCallbackPayload>,
    res: Response,
  ) => {
    try {
      await ShippingService.receiveGHNTicketCallback(
        parseBody<GHNTicketCallbackPayload>(req.body),
      );
    } catch (error) {
      console.error("GHN ticket callback processing failed:", error);
    }

    return res.status(200).json({ code: 200, message: "Success" });
  },
};

import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/common";
import { ShippingService } from "./shipping.service";
import type {
  GHNOrderStatusCallbackPayload,
  GHNTicketCallbackPayload,
  ShippingAddressDistrictQuery,
  ShippingAddressWardQuery,
  ShippingAvailableServicesInput,
  ShippingAvailableServicesByLocationInput,
  ShippingConnectInput,
  ShippingDisconnectInput,
  ShippingFeeQuoteInput,
  ShippingFeeQuoteByLocationInput,
  ShippingLocationResolveInput,
  ShippingProviderParams,
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
    req: Request,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.listProviders(req.store.id);
    return res.status(200).json(data);
  },

  getConnectionDetail: async (
    req: Request<ShippingProviderParams>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.getConnectionDetail(req.params.code, req.store.id);
    return res.status(200).json(data);
  },

  listProviderProvinces: async (
    req: Request<ShippingProviderParams>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.listProviderProvinces(req.params.code, req.store.id);
    return res.status(200).json(data);
  },

  listProviderDistricts: async (
    req: Request<ShippingProviderParams, {}, {}, ShippingAddressDistrictQuery>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.listProviderDistricts(req.params.code, req.store.id, req.query);
    return res.status(200).json(data);
  },

  listProviderWards: async (
    req: Request<ShippingProviderParams, {}, {}, ShippingAddressWardQuery>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.listProviderWards(req.params.code, req.store.id, req.query);
    return res.status(200).json(data);
  },

  listAvailableServices: async (
    req: Request<ShippingProviderParams, {}, ShippingAvailableServicesInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.listAvailableServices(req.params.code, req.store.id, parseBody<ShippingAvailableServicesInput>(req.body));
    return res.status(200).json(data);
  },

  resolveProviderLocation: async (
    req: Request<ShippingProviderParams, {}, ShippingLocationResolveInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.resolveProviderLocation(req.params.code, req.store.id, parseBody<ShippingLocationResolveInput>(req.body));
    return res.status(200).json(data);
  },

  listAvailableServicesByLocation: async (
    req: Request<ShippingProviderParams, {}, ShippingAvailableServicesByLocationInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.listAvailableServicesByLocation(req.params.code, req.store.id, parseBody<ShippingAvailableServicesByLocationInput>(req.body));
    return res.status(200).json(data);
  },

  calculateFee: async (
    req: Request<ShippingProviderParams, {}, ShippingFeeQuoteInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.calculateFee(req.params.code, req.store.id, parseBody<ShippingFeeQuoteInput>(req.body));
    return res.status(200).json(data);
  },

  calculateFeeByLocation: async (
    req: Request<ShippingProviderParams, {}, ShippingFeeQuoteByLocationInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.calculateFeeByLocation(req.params.code, req.store.id, parseBody<ShippingFeeQuoteByLocationInput>(req.body));
    return res.status(200).json(data);
  },

  connectProvider: async (
    req: Request<ShippingProviderParams, {}, ShippingConnectInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.connectProvider(req.params.code, req.store.id, parseBody<ShippingConnectInput>(req.body));
    return res.status(200).json(data);
  },

  disconnectProvider: async (
    req: Request<ShippingProviderParams, {}, ShippingDisconnectInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.disconnectProvider(req.params.code, req.store.id, parseBody<ShippingDisconnectInput>(req.body));
    return res.status(200).json(data);
  },

  verifyProvider: async (
    req: Request<ShippingProviderParams, {}, ShippingVerifyInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await ShippingService.verifyProvider(req.params.code, req.store.id, parseBody<ShippingVerifyInput>(req.body));
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

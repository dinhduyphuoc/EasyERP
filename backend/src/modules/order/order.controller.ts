import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/common";
import { OrderService } from "./order.service";
import type {
  DuplicateOrderRequestInput,
  OrderActionName,
  OrderActionRequestInput,
  OrderListQuery,
  OrderParams,
  OrderRequestInput,
  OrderShippingPrintResponse,
  UpdateOrderRequestInput,
} from "./order.types";

const parseId = (value: string | undefined) => {
  const id = Number(value);

  if (!value || Number.isNaN(id) || id <= 0 || !Number.isInteger(id)) {
    throw new BadRequestError("Invalid id");
  }

  return id;
};

const parsePayload = <T>(body: unknown) => {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body is required");
  }

  return body as T;
};

export const OrderController = {
  getOrderOptions: async (_req: Request, res: Response) => {
    if (!_req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const options = await OrderService.getOrderOptions(_req.store.id);
    return res.status(200).json(options);
  },

  getOrders: async (
    req: Request<{}, {}, {}, OrderListQuery>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const orders = await OrderService.getOrders(req.store.id, req.query);
    return res.status(200).json(orders);
  },

  getOrderById: async (req: Request<OrderParams>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const order = await OrderService.getOrderById(req.store.id, parseId(req.params.id));
    return res.status(200).json(order);
  },

  getGHNPrintInfo: async (req: Request<OrderParams>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await OrderService.getGHNPrintInfo(req.store.id, parseId(req.params.id));
    return res.status(200).json(data satisfies OrderShippingPrintResponse);
  },

  createOrder: async (
    req: Request<{}, {}, OrderRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const order = await OrderService.createOrder(
      req.store.id,
      parsePayload<OrderRequestInput>(req.body),
      req.auth
        ? {
            userId: req.auth.user.id,
            tenantId: req.auth.user.tenant_id,
            fullName: req.auth.user.full_name,
            permissions: req.auth.permissions,
          }
        : undefined,
    );
    return res.status(201).json(order);
  },

  updateOrder: async (
    req: Request<OrderParams, {}, UpdateOrderRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const order = await OrderService.updateOrder(
      req.store.id,
      parseId(req.params.id),
      parsePayload<UpdateOrderRequestInput>(req.body),
      req.auth
        ? {
            userId: req.auth.user.id,
            tenantId: req.auth.user.tenant_id,
            fullName: req.auth.user.full_name,
            permissions: req.auth.permissions,
          }
        : undefined,
    );
    return res.status(200).json(order);
  },

  duplicateOrder: async (
    req: Request<OrderParams, {}, DuplicateOrderRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const order = await OrderService.duplicateOrder(
      req.store.id,
      parseId(req.params.id),
      req.body && typeof req.body === "object"
        ? (req.body as DuplicateOrderRequestInput)
        : {},
      req.auth
        ? {
            userId: req.auth.user.id,
            tenantId: req.auth.user.tenant_id,
            fullName: req.auth.user.full_name,
            permissions: req.auth.permissions,
          }
        : undefined,
    );
    return res.status(201).json(order);
  },

  runAction: async (
    req: Request<{ id?: string; action?: string }, {}, OrderActionRequestInput>,
    res: Response,
  ) => {
    if (!req.params.action) {
      throw new BadRequestError("Invalid action");
    }
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }

    const order = await OrderService.runAction(
      req.store.id,
      parseId(req.params.id),
      req.params.action as OrderActionName,
      parsePayload<OrderActionRequestInput>(req.body),
      req.auth
        ? {
            userId: req.auth.user.id,
            tenantId: req.auth.user.tenant_id,
            fullName: req.auth.user.full_name,
            permissions: req.auth.permissions,
          }
        : undefined,
    );
    return res.status(200).json(order);
  },
};
